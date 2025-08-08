import { app, BrowserWindow } from 'electron';
import path from 'path';
import express from 'express';
import fs from 'fs';
import archiver from 'archiver';
import cors from 'cors';
import JsBarcode from 'jsbarcode';
import { createCanvas } from 'canvas';
import * as bwipjs from 'bwip-js';

let mainWindow: BrowserWindow | null = null;
let server: any = null;

// 바코드 타입별 설정
const BARCODE_CONFIGS = {
    'itf14': {
        bcid: 'interleaved2of5',
        length: 14,
        options: {
            bordertop: 8,
            borderbottom: 8,
            borderleft: 8,
            borderright: 8,
        }
    },
    'ean13': {
        bcid: 'ean13',
        length: [12, 13],
        options: {}
    }
} as const;

/**
 * 바코드 데이터에서 종류를 자동으로 감지
 */
function detectBarcodeType(code: string): string | null {
    if (!/^\d+$/.test(code)) return null;
    
    if (code.length === 14) return 'itf14';
    if ([12, 13].includes(code.length)) return 'ean13';
    
    return null;
}

/**
 * 바코드 데이터 유효성 검사
 */
function validateCode(code: string, type: string): boolean {
    if (!/^\d+$/.test(code)) return false;
    
    const config = BARCODE_CONFIGS[type as keyof typeof BARCODE_CONFIGS];
    if (!config) return false;
    
    const expectedLength = config.length;
    if (Array.isArray(expectedLength)) {
        return expectedLength.includes(code.length);
    }
    return code.length === expectedLength;
}

/**
 * bwip-js를 사용하여 바코드 파일 생성
 */
function generateBarcodeWithBwip({ code, type, heightMM, widthMM, outPath }: {
    code: string;
    type: string;
    heightMM: number;
    widthMM: number;
    outPath: string;
}): Promise<string> {
    return new Promise((resolve, reject) => {
        try {
            const config = BARCODE_CONFIGS[type as keyof typeof BARCODE_CONFIGS];
            if (!config) {
                throw new Error(`지원하지 않는 바코드 타입: ${type}`);
            }

            const bwipOptions: any = {
                bcid: config.bcid,
                text: code,
                scale: Math.max(3, widthMM),
                height: Math.max(20, heightMM / 3),
                includetext: true,
                textxalign: 'center' as const,
                textyalign: 'below' as const,
                textyoffset: 5,
                textsize: 12,
                guardwhitespace: true,
                paddingwidth: 20,
                paddingheight: 30,
                barcolor: '000000',
                backgroundcolor: 'FFFFFF',
                ...config.options
            };

            bwipjs.toBuffer(bwipOptions, (err: any, png: any) => {
                if (err) {
                    // bwip-js 실패 시 JsBarcode로 fallback
                    const canvas = createCanvas(400, 100);
                    JsBarcode(canvas, code, {
                        format: 'CODE128',
                        width: widthMM,
                        height: heightMM,
                        displayValue: true,
                        margin: 15,
                        background: '#ffffff',
                        lineColor: '#000000'
                    });
                    
                    const buffer = canvas.toBuffer('image/png');
                    const finalPath = outPath.replace('.svg', '.png');
                    fs.writeFileSync(finalPath, buffer);
                    resolve(finalPath);
                } else {
                    const finalPath = outPath.replace('.svg', '.png');
                    fs.writeFileSync(finalPath, png);
                    resolve(finalPath);
                }
            });
        } catch (error: any) {
            reject(new Error(`바코드 생성 실패: ${error.message}`));
        }
    });
}

/**
 * Express 서버 시작
 */
function startServer() {
    const expressApp = express();
    expressApp.use(express.json());
    expressApp.use(cors());

    // 바코드 미리보기 API
    expressApp.post('/preview-barcode', async (req, res) => {
        try {
            const { code, heightMM, widthMM } = req.body;

            if (!code?.trim()) {
                return res.status(400).json({ error: '바코드 번호를 입력해주세요.' });
            }

            const cleanCode = code.trim().replace(/\s+/g, '');
            const type = detectBarcodeType(cleanCode);

            if (!type || !validateCode(cleanCode, type)) {
                return res.status(400).json({ 
                    error: '유효하지 않은 바코드 번호입니다. (14자리: ITF-14, 12~13자리: EAN-13)' 
                });
            }

            const h = Number(heightMM) || 32;
            const w = Number(widthMM) || 2;
            const filename = `preview_${cleanCode}_${Date.now()}.png`;
            const outPath = path.join(app.getPath('temp'), filename);

            await generateBarcodeWithBwip({ code: cleanCode, type, heightMM: h, widthMM: w, outPath });
            
            const imageBuffer = fs.readFileSync(outPath);
            const base64Image = imageBuffer.toString('base64');
            
            fs.unlinkSync(outPath);
            
            res.json({ 
                success: true,
                image: `data:image/png;base64,${base64Image}`,
                code: cleanCode,
                type: type.toUpperCase()
            });
        } catch (error: any) {
            res.status(500).json({ error: `바코드 생성 실패: ${error.message}` });
        }
    });

    // 바코드 일괄 생성 API
    expressApp.post('/generate-batch', async (req, res) => {
        const outDir = path.join(app.getPath('temp'), `barcodes_${Date.now()}`);
        if (!fs.existsSync(outDir)) {
            fs.mkdirSync(outDir, { recursive: true });
        }

        try {
            const { barcodeNumbers, heightMM, widthMM, filenamePrefix } = req.body;

            if (!Array.isArray(barcodeNumbers) || barcodeNumbers.length === 0) {
                return res.status(400).json({ error: '바코드 번호가 제공되지 않았습니다.' });
            }

            const codes = barcodeNumbers
                .map(code => String(code).trim())
                .filter(Boolean);

            if (codes.length === 0) {
                return res.status(400).json({ error: '유효한 바코드 번호를 입력해주세요.' });
            }

            const successfulFiles: string[] = [];
            const failedCodes: Array<{ code: string; reason: string }> = [];

            const h = Number(heightMM) || 32;
            const w = Number(widthMM) || 2;
            
            await Promise.all(codes.map(async (rawCode) => {
                const code = rawCode.replace(/\s+/g, '');
                const type = detectBarcodeType(code);
                
                if (!type || !validateCode(code, type)) {
                    failedCodes.push({ 
                        code: rawCode, 
                        reason: '유효하지 않은 데이터 (14자리: ITF-14, 12~13자리: EAN-13)' 
                    });
                    return;
                }

                const filename = `${filenamePrefix || ''}${code}.png`;
                const outPath = path.join(outDir, filename);

                try {
                    await generateBarcodeWithBwip({ code, type, heightMM: h, widthMM: w, outPath });
                    successfulFiles.push(filename);
                } catch (e: any) {
                    failedCodes.push({ code: rawCode, reason: e.message });
                }
            }));

            if (successfulFiles.length === 0) {
                return res.status(400).json({ 
                    error: '생성된 바코드가 없습니다. 데이터나 옵션을 확인하세요.',
                    details: failedCodes
                });
            }

            // ZIP 파일 생성 및 전송
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', 'attachment; filename="barcodes.zip"');

            const archive = archiver('zip', { zlib: { level: 9 } });
            archive.on('error', err => { throw err; });
            archive.pipe(res);

            // 바코드 파일들 추가
            for (const filename of successfulFiles) {
                archive.file(path.join(outDir, filename), { name: filename });
            }

            // 리포트 파일 추가
            const report = {
                generationDate: new Date().toISOString(),
                note: '바코드 종류는 자동으로 감지됩니다 (14자리: ITF-14, 12~13자리: EAN-13)',
                options: { heightMM: h, filenamePrefix: filenamePrefix || '' },
                successCount: successfulFiles.length,
                errorCount: failedCodes.length,
                errors: failedCodes,
            };
            archive.append(JSON.stringify(report, null, 2), { name: 'report.json' });

            await archive.finalize();

        } catch (error: any) {
            res.status(500).json({ 
                error: '서버 내부 오류가 발생했습니다.', 
                details: error.message 
            });
        } finally {
            if (fs.existsSync(outDir)) {
                fs.rmSync(outDir, { recursive: true, force: true });
            }
        }
    });

    server = expressApp.listen(3000, () => {
        console.log('Barcode server running on http://localhost:3000');
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, '../preload/preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        title: '바코드 일괄 생성기',
        show: false,
    });

    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.on('ready', () => {
    startServer();
    createWindow();
});

app.on('window-all-closed', () => {
    if (server) {
        server.close();
    }
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
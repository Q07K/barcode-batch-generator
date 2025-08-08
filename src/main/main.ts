import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import express from 'express';
import fs from 'fs';
import archiver from 'archiver';
import cors from 'cors';
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
function generateBarcodeWithBwip({ code, type, heightMM, widthMM, outPath, fileFormat = 'png' }: {
    code: string;
    type: string;
    heightMM: number;
    widthMM: number;
    outPath: string;
    fileFormat?: string;
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

            // 파일 형식에 따라 다른 생성 방법 사용
            if (fileFormat === 'svg') {
                try {
                    const svg = bwipjs.toSVG(bwipOptions);
                    const finalPath = outPath.replace(/\.[^.]+$/, '.svg');
                    fs.writeFileSync(finalPath, svg);
                    resolve(finalPath);
                } catch (err: any) {
                    reject(new Error(`SVG 바코드 생성 실패: ${err.message || err}`));
                }
            } else if (fileFormat === 'eps') {
                // EPS는 SVG를 기반으로 생성
                try {
                    const svg = bwipjs.toSVG(bwipOptions);
                    const eps = convertSVGToEPS(svg, code);
                    const finalPath = outPath.replace(/\.[^.]+$/, '.eps');
                    fs.writeFileSync(finalPath, eps);
                    resolve(finalPath);
                } catch (err: any) {
                    reject(new Error(`EPS 바코드 생성 실패: ${err.message || err}`));
                }
            } else {
                // 기본값: PNG
                bwipjs.toBuffer(bwipOptions, (err: any, png: any) => {
                    if (err) {
                        reject(new Error(`PNG 바코드 생성 실패: ${err.message || err}`));
                    } else {
                        const finalPath = outPath.replace(/\.[^.]+$/, '.png');
                        fs.writeFileSync(finalPath, png);
                        resolve(finalPath);
                    }
                });
            }
        } catch (error: any) {
            reject(new Error(`바코드 생성 실패: ${error.message}`));
        }
    });
}

/**
 * SVG를 간단한 EPS 형태로 변환
 */
function convertSVGToEPS(svg: string, code: string): string {
    // SVG에서 기본 정보 추출
    const widthMatch = svg.match(/width="(\d+)"/);
    const heightMatch = svg.match(/height="(\d+)"/);
    const width = widthMatch ? parseInt(widthMatch[1]) : 300;
    const height = heightMatch ? parseInt(heightMatch[1]) : 100;
    
    const eps = [
        '%!PS-Adobe-3.0 EPSF-3.0',
        `%%Title: Barcode ${code}`,
        `%%Creator: Barcode Batch Generator`,
        `%%BoundingBox: 0 0 ${width} ${height}`,
        '%%EndComments',
        '',
        '/Times-Roman findfont 12 scalefont setfont',
        '0 setgray',
        '',
        '% Barcode generation from SVG',
        '% This is a simplified EPS conversion',
        `% Original barcode: ${code}`,
        '',
        // SVG의 rect 요소들을 PostScript로 변환 (간단한 구현)
        ...convertSVGRectsToPS(svg),
        '',
        'showpage',
        '%%EOF'
    ];
    
    return eps.join('\n');
}

/**
 * SVG의 rect 요소들을 PostScript 명령어로 변환
 */
function convertSVGRectsToPS(svg: string): string[] {
    const commands: string[] = [];
    const rectRegex = /<rect[^>]*x="([^"]*)"[^>]*y="([^"]*)"[^>]*width="([^"]*)"[^>]*height="([^"]*)"[^>]*fill="([^"]*)"/g;
    
    let match;
    while ((match = rectRegex.exec(svg)) !== null) {
        const x = parseFloat(match[1]) || 0;
        const y = parseFloat(match[2]) || 0;
        const width = parseFloat(match[3]) || 1;
        const height = parseFloat(match[4]) || 1;
        const fill = match[5];
        
        // 검은색 사각형만 그리기 (바코드 바)
        if (fill === '#000000' || fill === 'black' || fill === '#000') {
            commands.push(`${x} ${y} ${width} ${height} rectfill`);
        }
    }
    
    // rectfill 함수 정의
    if (commands.length > 0) {
        commands.unshift('% Define rectfill function');
        commands.unshift('/rectfill { 4 2 roll moveto 1 index 0 rlineto 0 exch rlineto neg 0 rlineto closepath fill } def');
    }
    
    return commands;
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
            const { code, heightMM, widthMM, fileFormat } = req.body;

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
            const format = fileFormat || 'png';
            const extension = format === 'svg' ? '.svg' : format === 'eps' ? '.eps' : '.png';
            const filename = `preview_${cleanCode}_${Date.now()}${extension}`;
            const outPath = path.join(app.getPath('temp'), filename);

            await generateBarcodeWithBwip({ code: cleanCode, type, heightMM: h, widthMM: w, outPath, fileFormat: format });
            
            let imageData: string;
            if (format === 'svg') {
                const svgContent = fs.readFileSync(outPath, 'utf8');
                imageData = `data:image/svg+xml;base64,${Buffer.from(svgContent).toString('base64')}`;
            } else if (format === 'eps') {
                // EPS는 미리보기가 어려우므로 텍스트 정보만 표시
                imageData = 'data:text/plain;base64,' + Buffer.from('EPS 파일이 생성되었습니다. 다운로드하여 확인해주세요.').toString('base64');
            } else {
                const imageBuffer = fs.readFileSync(outPath);
                imageData = `data:image/png;base64,${imageBuffer.toString('base64')}`;
            }
            
            fs.unlinkSync(outPath);
            
            res.json({ 
                success: true,
                image: imageData,
                code: cleanCode,
                type: type.toUpperCase(),
                format: format.toUpperCase()
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
            const { barcodeNumbers, heightMM, widthMM, filenamePrefix, fileFormat } = req.body;

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
            const format = fileFormat || 'png';
            const extension = format === 'svg' ? '.svg' : format === 'eps' ? '.eps' : '.png';
            
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

                const filename = `${filenamePrefix || ''}${code}${extension}`;
                const outPath = path.join(outDir, filename);

                try {
                    await generateBarcodeWithBwip({ code, type, heightMM: h, widthMM: w, outPath, fileFormat: format });
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
                options: { 
                    heightMM: h, 
                    widthMM: w,
                    fileFormat: format,
                    filenamePrefix: filenamePrefix || '' 
                },
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
        frame: true, // 시스템 타이틀바 표시
        // titleBarStyle: 'hidden', // macOS용 추가 설정 - 주석 처리
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

// 윈도우 컨트롤 IPC 핸들러들
ipcMain.handle('window-minimize', () => {
    if (mainWindow) {
        mainWindow.minimize();
    }
});

ipcMain.handle('window-maximize', () => {
    if (mainWindow) {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    }
});

ipcMain.handle('window-close', () => {
    if (mainWindow) {
        mainWindow.close();
    }
});

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
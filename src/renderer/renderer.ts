// Barcode generation interface handler

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('barcode-form') as HTMLFormElement;
    const submitBtn = document.getElementById('submit-btn') as HTMLButtonElement;
    const previewBtn = document.getElementById('preview-btn') as HTMLButtonElement;
    const clearPreviewBtn = document.getElementById('clear-preview-btn') as HTMLButtonElement;
    const previewContainer = document.getElementById('preview-container') as HTMLDivElement;
    const previewContent = document.getElementById('preview-content') as HTMLDivElement;
    const loader = document.getElementById('loader') as HTMLDivElement;
    const errorMessage = document.getElementById('error-message') as HTMLParagraphElement;
    
    const API_BASE = 'http://localhost:3000';
    const GENERATE_API = `${API_BASE}/generate-batch`;
    const PREVIEW_API = `${API_BASE}/preview-barcode`;

    // 공통 함수: 바코드 번호들 가져오기
    const getBarcodeNumbers = (): string[] => {
        const textarea = document.getElementById('barcode-numbers') as HTMLTextAreaElement;
        return textarea.value
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
    };

    // 공통 함수: 옵션 값들 가져오기
    const getOptions = () => ({
        heightMM: (document.getElementById('heightMM') as HTMLInputElement).value,
        widthMM: (document.getElementById('widthMM') as HTMLInputElement).value,
        filenamePrefix: (document.getElementById('filenamePrefix') as HTMLInputElement).value
    });

    // 공통 함수: 로딩 상태 설정
    const setLoadingState = (button: HTMLButtonElement, isLoading: boolean, loadingText: string, normalText: string) => {
        button.disabled = isLoading;
        button.textContent = isLoading ? loadingText : normalText;
        if (isLoading) {
            button.classList.add('opacity-50');
        } else {
            button.classList.remove('opacity-50');
        }
    };

    // 바코드 미리보기 기능
    previewBtn?.addEventListener('click', async () => {
        const barcodeNumbers = getBarcodeNumbers();
        if (barcodeNumbers.length === 0) {
            alert('바코드 번호를 입력해주세요.');
            return;
        }

        const options = getOptions();
        setLoadingState(previewBtn, true, '생성 중...', '첫 번째 바코드 미리보기');

        try {
            const response = await fetch(PREVIEW_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: barcodeNumbers[0],
                    ...options
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '미리보기 생성 실패');
            }

            const result = await response.json();
            
            previewContent.innerHTML = `
                <div class="space-y-3">
                    <img src="${result.image}" alt="바코드 미리보기" class="mx-auto border border-gray-300 p-2 bg-white rounded">
                    <div class="text-sm text-gray-600">
                        <p><strong>번호:</strong> ${result.code}</p>
                        <p><strong>타입:</strong> ${result.type}</p>
                        <p><strong>높이:</strong> ${options.heightMM}mm</p>
                        <p><strong>너비 배율:</strong> ${options.widthMM}x</p>
                    </div>
                </div>
            `;
            
            previewContainer.classList.remove('hidden');
            clearPreviewBtn.classList.remove('hidden');

        } catch (error: any) {
            alert(`미리보기 오류: ${error.message}`);
        } finally {
            setLoadingState(previewBtn, false, '생성 중...', '첫 번째 바코드 미리보기');
        }
    });

    // 미리보기 지우기
    clearPreviewBtn?.addEventListener('click', () => {
        previewContainer.classList.add('hidden');
        clearPreviewBtn.classList.add('hidden');
        previewContent.innerHTML = '';
    });

    // 폼 제출 처리 (일괄 생성)
    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        loader.classList.remove('hidden');
        errorMessage.classList.add('hidden');
        setLoadingState(submitBtn, true, '생성 중...', '바코드 생성');

        const barcodeNumbers = getBarcodeNumbers();
        if (barcodeNumbers.length === 0) {
            errorMessage.textContent = '바코드 번호를 입력해주세요.';
            errorMessage.classList.remove('hidden');
            loader.classList.add('hidden');
            setLoadingState(submitBtn, false, '생성 중...', '바코드 생성');
            return;
        }

        const options = getOptions();
        const requestData = { barcodeNumbers, ...options };

        try {
            const response = await fetch(GENERATE_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP 오류! 상태: ${response.status}`);
            }

            // ZIP 파일 다운로드
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = downloadUrl;
            a.download = 'barcodes.zip';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(downloadUrl);
            a.remove();

        } catch (error: any) {
            errorMessage.textContent = `오류: ${error.message}`;
            errorMessage.classList.remove('hidden');
        } finally {
            loader.classList.add('hidden');
            setLoadingState(submitBtn, false, '생성 중...', '바코드 생성');
        }
    });
});
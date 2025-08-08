# Barcode Batch Generator

바코드를 일괄 생성할 수 있는 Electron 기반 데스크톱 애플리케이션입니다.

## 프로그램 소개

이 애플리케이션은 다음과 같은 기능을 제공합니다:
- 바코드 일괄 생성
- 다양한 바코드 형식 지원
- 직관적인 사용자 인터페이스
- 크로스 플랫폼 지원 (Windows, macOS, Linux)

## 빠른 시작 (일반 사용자용)

### 방법 1: 배포된 실행파일 다운로드 (권장)

1. [Releases 페이지](https://github.com/Q07K/barcode-batch-generator/releases)로 이동
2. 최신 버전에서 운영체제에 맞는 파일 다운로드:
   - **Windows**: `barcode-batch-generator-win32-x64.zip` (압축 해제 후 `barcode-batch-generator.exe` 실행)
   - **macOS**: `(준비중)`
   - **Linux**: `(준비중)`
3. 다운로드한 파일을 압축 해제
4. 압축 해제된 폴더에서 `barcode-batch-generator.exe` 실행

### 방법 2: 소스코드에서 직접 실행

#### 사전 요구사항
- [Node.js](https://nodejs.org/) (버전 16 이상)
- [Git](https://git-scm.com/)

#### 설치 및 실행 단계

1. **저장소 복제**
   ```bash
   git clone https://github.com/Q07K/barcode-batch-generator.git
   cd barcode-batch-generator
   ```

2. **의존성 설치**
   ```bash
   npm install
   ```

3. **프로그램 실행**
   ```bash
   npm start
   ```

## 개발자용 가이드

### 개발 환경 설정

1. **저장소 복제 및 의존성 설치** (위와 동일)

2. **개발 모드로 실행**
   ```bash
   npm run dev
   ```

3. **빌드**
   ```bash
   npm run build
   ```

4. **배포용 실행파일 생성**
   ```bash
   npm run dist
   ```
   - 생성 위치: `release/win-unpacked/`
   - ⚠️ **Windows에서는 반드시 관리자 모드로 PowerShell을 실행**해야 함
   - PowerShell을 "관리자 권한으로 실행" 후 명령어 실행

### 프로젝트 구조

```
barcode-batch-generator/
├── src/
│   ├── main/
│   │   └── main.ts          # 메인 프로세스 진입점
│   ├── renderer/
│   │   ├── index.html       # 렌더러 프로세스용 HTML
│   │   ├── renderer.ts      # 렌더러 프로세스 스크립트
│   │   ├── styles.css       # 스타일시트
│   │   └── types.d.ts       # 타입 정의
│   └── preload/
│       └── preload.ts       # 보안 API 노출용 프리로드 스크립트
├── dist/                    # 컴파일된 JavaScript 파일들
├── release/                 # 배포용 실행파일들 (생성 후)
├── package.json             # npm 설정 파일
├── tsconfig.json            # TypeScript 설정 파일
└── README.md                # 프로젝트 문서
```

### 사용 가능한 NPM 스크립트

- `npm start` - 애플리케이션 빌드 후 실행
- `npm run dev` - 개발 모드로 실행
- `npm run build` - TypeScript를 JavaScript로 컴파일
- `npm run dist` - 배포용 실행파일 생성 (관리자 권한 필요)
- `npm run clean` - 빌드 및 배포 파일 정리

## 문제 해결

### 일반적인 문제들

1. **"Node.js를 찾을 수 없습니다" 오류**
   - [Node.js 공식 웹사이트](https://nodejs.org/)에서 최신 LTS 버전 설치

2. **의존성 설치 실패**
   ```bash
   # npm 캐시 정리 후 재시도
   npm cache clean --force
   npm install
   ```

3. **권한 오류 (Windows)**
   - 관리자 권한으로 명령 프롬프트 실행

4. **실행 시 빈 화면만 나타나는 경우**
   ```bash
   # 빌드 후 재실행
   npm run build
   npm start
   ```

5. **`npm run dist` 실행 시 "Cannot create symbolic link" 오류**
   - **해결 방법**: 관리자 권한으로 PowerShell 실행
   - PowerShell을 "관리자 권한으로 실행" 후 `npm run dist` 명령어 실행

### 지원 받기

문제가 발생하면 다음과 같이 도움을 받을 수 있습니다:

1. [Issues 페이지](https://github.com/Q07K/barcode-batch-generator/issues)에서 기존 문제 확인
2. 새로운 이슈 작성 시 다음 정보 포함:
   - 운영체제 및 버전
   - Node.js 버전 (`node --version`)
   - 오류 메시지 전문
   - 재현 단계

## 라이선스

이 프로젝트는  Apache 2.0 라이선스 하에 배포됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 기여하기

프로젝트에 기여하고 싶으시다면:

1. 저장소를 Fork
2. 새로운 브랜치 생성 (`git checkout -b feature/AmazingFeature`)
3. 변경사항 커밋 (`git commit -m 'Add some AmazingFeature'`)
4. 브랜치에 Push (`git push origin feature/AmazingFeature`)
5. Pull Request 생성

---

⭐ 이 프로젝트가 도움이 되었다면 스타를 눌러주세요!
export const API_URLS = {
  local: "http://localhost:8080/api",
  dev: "https://cnkplanet.co.kr/api", // 개발 서버 URL (변경 필요)
  prod: "https://cnkplanet.co.kr/api",     // 운영 서버 URL (변경 필요)
};

// VITE_APP_ENV 환경 변수를 통해 강제로 환경을 지정할 수 있습니다. (예: .env 파일에 VITE_APP_ENV=dev 추가)
// 지정되지 않은 경우:
// - npm run dev (wails dev) 실행 시 -> 'local'
// - npm run build (wails build) 실행 시 -> 'prod'
const ENV_KEY = import.meta.env.VITE_APP_ENV || (import.meta.env.DEV ? 'local' : 'prod');

export const API_BASE_URL = API_URLS[ENV_KEY as keyof typeof API_URLS] || API_URLS.prod;

console.log(`Current API Environment: ${ENV_KEY}, URL: ${API_BASE_URL}`);

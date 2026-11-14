// 네이버 지도(NCP Maps JS v3) 스크립트를 한 번만 불러온다.
// 키(ncpKeyId)는 브라우저에 보이는 값이다. Secret은 여기에 두지 않는다.

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    naver?: any;
    /** 키가 틀리거나 도메인이 등록되지 않으면 네이버 스크립트가 부르는 함수 */
    navermap_authFailure?: () => void;
  }
}

const DEFAULT_SCRIPT_URL = 'https://oapi.map.naver.com/openapi/v3/maps.js';
const LOAD_TIMEOUT_MS = 8000;

export type NaverMapState = 'loading' | 'ready' | 'fail';

let promise: Promise<any> | null = null;
let authFailed = false;
const authListeners = new Set<() => void>();

/** 인증 실패 시 SDK 내부 객체도 해제되므로 이후 SDK 호출을 피한다. */
export function hasNaverAuthFailed(): boolean {
  return authFailed;
}

/** 스크립트 주소. 키가 없거나 https가 아니면 null. */
export function naverMapScriptUrl(
  env: { VITE_NAVER_MAP_SCRIPT_URL?: string; VITE_NAVER_MAP_KEY_ID?: string } = import.meta.env,
): string | null {
  const key = env.VITE_NAVER_MAP_KEY_ID?.trim();
  if (!key) return null;
  let u: URL;
  try {
    u = new URL(env.VITE_NAVER_MAP_SCRIPT_URL?.trim() || DEFAULT_SCRIPT_URL);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  u.searchParams.set('ncpKeyId', key);
  return u.toString();
}

/** 인증 실패를 알림받는다. 해제 함수를 돌려준다. */
export function onNaverAuthFailure(fn: () => void): () => void {
  if (authFailed) fn();
  authListeners.add(fn);
  return () => {
    authListeners.delete(fn);
  };
}

/** window.naver.maps를 돌려준다. 키 없음·로드 실패·시간 초과면 reject. */
export function loadNaverMaps(): Promise<any> {
  if (authFailed) return Promise.reject(new Error('네이버 지도 인증에 실패했습니다.'));
  if (promise) return promise;
  const src = naverMapScriptUrl();
  if (!src) return Promise.reject(new Error('VITE_NAVER_MAP_KEY_ID가 없습니다.'));
  if (window.naver?.maps) return (promise = Promise.resolve(window.naver.maps));

  window.navermap_authFailure = () => {
    authFailed = true;
    authListeners.forEach((f) => f());
  };

  promise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    const timer = setTimeout(() => reject(new Error('네이버 지도 로드 시간 초과')), LOAD_TIMEOUT_MS);
    s.onload = () => {
      clearTimeout(timer);
      if (authFailed) reject(new Error('네이버 지도 인증에 실패했습니다.'));
      else if (window.naver?.maps) resolve(window.naver.maps);
      else reject(new Error('네이버 지도 객체가 없습니다.'));
    };
    s.onerror = () => {
      clearTimeout(timer);
      reject(new Error('네이버 지도 스크립트를 불러오지 못했습니다.'));
    };
    document.head.appendChild(s);
  });
  // 실패하면 다음 화면 진입 때 다시 시도할 수 있게 비운다.
  promise.catch(() => {
    promise = null;
  });
  return promise;
}

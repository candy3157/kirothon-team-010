import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('지도 인증 실패', () => {
  it('스크립트 로드 전에 인증이 실패하면 준비 완료로 처리하지 않는다', async () => {
    vi.stubEnv('VITE_NAVER_MAP_KEY_ID', 'test-key');
    const win: any = { naver: undefined };
    let script: any;
    vi.stubGlobal('window', win);
    vi.stubGlobal('document', {
      createElement: () => ({}),
      head: { appendChild: (s: any) => { script = s; } },
    });
    const sdk = await import('./naverMap');
    const loading = sdk.loadNaverMaps();
    const failed = vi.fn();
    sdk.onNaverAuthFailure(failed);
    win.naver = { maps: {} };
    win.navermap_authFailure();
    script.onload();
    await expect(loading).rejects.toThrow('인증');
    expect(failed).toHaveBeenCalledOnce();
    expect(sdk.hasNaverAuthFailed()).toBe(true);
    await expect(sdk.loadNaverMaps()).rejects.toThrow('인증');
  });

  it('이미 로드된 SDK가 나중에 인증 실패해도 정리 단계에서 감지할 수 있다', async () => {
    vi.stubEnv('VITE_NAVER_MAP_KEY_ID', 'test-key');
    const win: any = {};
    let script: any;
    vi.stubGlobal('window', win);
    vi.stubGlobal('document', {
      createElement: () => ({}),
      head: { appendChild: (s: any) => { script = s; } },
    });
    const sdk = await import('./naverMap');
    const loading = sdk.loadNaverMaps();
    win.naver = { maps: {} };
    script.onload();
    await loading;
    expect(sdk.hasNaverAuthFailed()).toBe(false);
    win.navermap_authFailure();
    win.naver = null;
    expect(sdk.hasNaverAuthFailed()).toBe(true);
    const late = vi.fn();
    sdk.onNaverAuthFailure(late);
    expect(late).toHaveBeenCalledOnce();
  });
});

'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell, BellRing, X, Share, Plus, Loader2 } from 'lucide-react';
import { SCHOOLS } from '@/const/schools';
import { boardKey } from '@/lib/boards';
import {
    currentSubscription,
    isIos,
    isStandalone,
    pushSupported,
    subscribe,
    unsubscribe,
    VAPID_PUBLIC_KEY,
} from '@/lib/push-client';

type Status = 'loading' | 'unsupported' | 'needs-install' | 'off' | 'on';

export default function NotifyButton() {
    const [open, setOpen] = useState(false);
    const [status, setStatus] = useState<Status>('loading');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        (async () => {
            if (!pushSupported() || !VAPID_PUBLIC_KEY) {
                // iOS는 설치 전에는 PushManager 자체가 없다 — "미지원"이 아니라 "설치 필요"다.
                setStatus(isIos() && !isStandalone() ? 'needs-install' : 'unsupported');
                return;
            }

            const sub = await currentSubscription();
            if (!sub) return setStatus('off');

            const res = await fetch(
                `/api/push/subscribe?endpoint=${encodeURIComponent(sub.endpoint)}`,
            );
            const data = res.ok ? await res.json() : { subscribed: false, boards: [] };
            setSelected(new Set<string>(data.boards ?? []));
            setStatus(data.subscribed ? 'on' : 'off');
        })().catch(() => setStatus('unsupported'));
    }, []);

    const save = useCallback(async (boards: Set<string>) => {
        const sub = await subscribe();
        const res = await fetch('/api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscription: sub.toJSON(), boards: [...boards] }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? '저장 실패');
        setStatus(boards.size > 0 ? 'on' : 'off');
    }, []);

    const toggleBoard = useCallback(
        async (key: string) => {
            const next = new Set(selected);
            if (next.has(key)) next.delete(key);
            else next.add(key);

            setSelected(next);
            setBusy(true);
            setMessage('');
            try {
                await save(next);
            } catch (error) {
                setSelected(selected); // 실패하면 되돌린다
                setMessage(error instanceof Error ? error.message : '저장에 실패했습니다.');
            } finally {
                setBusy(false);
            }
        },
        [selected, save],
    );

    const handleTest = useCallback(async () => {
        setBusy(true);
        setMessage('');
        try {
            const sub = await currentSubscription();
            if (!sub) throw new Error('구독 정보를 찾을 수 없습니다.');
            const res = await fetch('/api/push/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ endpoint: sub.endpoint }),
            });
            setMessage(res.ok ? '테스트 알림을 보냈습니다.' : (await res.json()).error);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : '테스트에 실패했습니다.');
        } finally {
            setBusy(false);
        }
    }, []);

    const handleOff = useCallback(async () => {
        setBusy(true);
        try {
            const endpoint = await unsubscribe();
            if (endpoint) {
                await fetch('/api/push/subscribe', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ endpoint }),
                });
            }
            setSelected(new Set());
            setStatus('off');
            setMessage('알림을 껐습니다.');
        } finally {
            setBusy(false);
        }
    }, []);

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="relative p-2 text-gray-500 hover:text-blue-600 transition-colors"
                title="새 공지 알림 설정"
                aria-label="새 공지 알림 설정"
            >
                {status === 'on' ? <BellRing size={20} className="text-blue-600" /> : <Bell size={20} />}
                {status === 'on' && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-600 rounded-full" />
                )}
            </button>

            {open && (
                <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
                    <div className="bg-white w-full sm:max-w-md sm:rounded-lg rounded-t-2xl shadow-xl max-h-[85vh] flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                                <Bell size={18} className="text-blue-600" />새 공지 알림
                            </h2>
                            <button
                                onClick={() => setOpen(false)}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                                aria-label="닫기"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-4 overflow-y-auto flex-1">
                            {status === 'loading' && (
                                <p className="text-sm text-gray-600 py-6 text-center">확인 중…</p>
                            )}

                            {status === 'needs-install' && <IosInstallGuide />}

                            {status === 'unsupported' && (
                                <p className="text-sm text-gray-600 py-6 text-center">
                                    이 브라우저는 알림을 지원하지 않습니다. Chrome 또는 Safari에서 열어주세요.
                                </p>
                            )}

                            {(status === 'off' || status === 'on') && (
                                <>
                                    <p className="text-sm text-gray-600 mb-4">
                                        알림 받을 게시판을 선택하세요. 선택한 게시판에 새 글이 올라오면
                                        10분 안에 알려드립니다.
                                    </p>

                                    <div className="space-y-4">
                                        {SCHOOLS.map((school) => (
                                            <div key={school.id}>
                                                <h3 className="text-xs font-semibold text-gray-500 mb-1.5">
                                                    {school.name}
                                                </h3>
                                                <div className="flex flex-wrap gap-2">
                                                    {(school.boards ?? []).map((board) => {
                                                        const key = boardKey(school.sysId, board.bbsId);
                                                        const active = selected.has(key);
                                                        return (
                                                            <button
                                                                key={key}
                                                                disabled={busy}
                                                                onClick={() => toggleBoard(key)}
                                                                className={`px-3 py-1.5 rounded-full text-sm border transition-colors disabled:opacity-50 ${
                                                                    active
                                                                        ? 'bg-blue-600 text-white border-blue-600'
                                                                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                                                }`}
                                                            >
                                                                {board.name}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}

                            {message && (
                                <p className="mt-4 text-sm text-blue-700 bg-blue-50 rounded-md p-2">{message}</p>
                            )}
                        </div>

                        {(status === 'off' || status === 'on') && (
                            <div className="p-4 border-t bg-gray-50 flex items-center justify-between gap-2 sm:rounded-b-lg">
                                <button
                                    onClick={handleOff}
                                    disabled={busy || status === 'off'}
                                    className="px-3 py-2 text-sm text-gray-600 hover:text-red-600 disabled:opacity-40 transition-colors"
                                >
                                    알림 끄기
                                </button>
                                <button
                                    onClick={handleTest}
                                    disabled={busy || status === 'off'}
                                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                                >
                                    {busy && <Loader2 size={14} className="animate-spin" />}
                                    테스트 알림
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}

// iPhone은 Safari에서 바로 알림을 켤 수 없다. 이 안내가 없으면 아이폰 사용자는
// 버튼을 눌러도 아무 일이 없는 것처럼 보인다.
function IosInstallGuide() {
    return (
        <div className="py-2">
            <p className="text-sm text-gray-700 mb-4">
                iPhone·iPad에서는 <strong>홈 화면에 추가</strong>한 뒤에야 알림을 받을 수 있습니다.
            </p>
            <ol className="space-y-3 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-medium">
                        1
                    </span>
                    <span className="flex items-center gap-1 flex-wrap">
                        아래쪽 <Share size={14} className="inline text-blue-600" /> 공유 버튼을 누르세요.
                    </span>
                </li>
                <li className="flex items-start gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-medium">
                        2
                    </span>
                    <span className="flex items-center gap-1 flex-wrap">
                        <Plus size={14} className="inline text-blue-600" />
                        <strong>홈 화면에 추가</strong>를 선택하세요.
                    </span>
                </li>
                <li className="flex items-start gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-medium">
                        3
                    </span>
                    <span>홈 화면에 생긴 아이콘으로 다시 열고, 이 버튼을 누르세요.</span>
                </li>
            </ol>
        </div>
    );
}

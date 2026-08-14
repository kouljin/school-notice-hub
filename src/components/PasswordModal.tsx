import { useState } from 'react';
import { X, KeyRound } from 'lucide-react';

interface PasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function PasswordModal({ isOpen, onClose, onSuccess }: PasswordModalProps) {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // ponytail: 인증이 아니라 실수 방지용 잠금이다 — 지키는 대상이 각자 브라우저의
        // localStorage뿐이라 우회해도 얻는 게 없다. NEXT_PUBLIC_ 이라 번들에도 실린다.
        // 설정이 Firestore로 옮겨가는 시점에 서버에서 검사하도록 바꿔야 한다.
        const expected = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;
        if (!expected) {
            setError('관리자 비밀번호가 설정되지 않았습니다 (NEXT_PUBLIC_ADMIN_PASSWORD).');
            return;
        }

        if (password === expected) {
            setError('');
            setPassword('');
            onSuccess();
        } else {
            setError('비밀번호가 일치하지 않습니다.');
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b bg-gray-50">
                    <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                        <KeyRound size={20} className="text-blue-600" />
                        관리자 인증
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6">
                    <p className="text-sm text-gray-600 mb-4">
                        설정을 변경하려면 관리자 비밀번호를 입력해주세요.
                    </p>

                    <div className="mb-4">
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                setError(''); // Clear error on typing
                            }}
                            placeholder="비밀번호 입력"
                            autoFocus
                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${error ? 'border-red-500 bg-red-50' : 'bg-white'
                                }`}
                        />
                        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
                    </div>

                    <button
                        type="submit"
                        className="w-full py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
                    >
                        확인
                    </button>
                </form>
            </div>
        </div>
    );
}

import { useState } from 'react';
import { X, Check, AlertCircle } from 'lucide-react';
import { School, Board } from '@/types';
interface AddSchoolModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (school: School) => void;
}

export default function AddSchoolModal({ isOpen, onClose, onAdd }: AddSchoolModalProps) {
    const [name, setName] = useState('');
    const [sysId, setSysId] = useState('');
    const [error, setError] = useState('');

    // Default structure for a new school
    const initialBoards: Board[] = [
        { id: 'notice', name: '공지사항', mi: '', bbsId: '' },
        { id: 'family_letter', name: '가정통신문', mi: '', bbsId: '' },
        { id: 'eval_plan', name: '평가계획', mi: '', bbsId: '' }
    ];

    const [boards, setBoards] = useState<Board[]>(initialBoards);

    if (!isOpen) return null;

    const handleUrlPaste = (index: number, urlString: string) => {
        if (!urlString.trim()) return;
        try {
            const url = new URL(urlString);

            // Try to extract sysId from path if not manually set yet (e.g., /cheongdoms/...)
            if (!sysId) {
                const pathParts = url.pathname.split('/');
                if (pathParts.length > 1 && pathParts[1]) {
                    setSysId(pathParts[1]);
                }
            }

            const mi = url.searchParams.get('mi');
            const bbsId = url.searchParams.get('bbsId');

            if (mi && bbsId) {
                const newBoards = [...boards];
                newBoards[index] = { ...newBoards[index], mi, bbsId };
                setBoards(newBoards);
            }
        } catch (err) {
            // Ignore invalid URLs while typing or pasting
        }
    };

    const handleBoardChange = (index: number, field: keyof Board, value: string) => {
        const newBoards = [...boards];
        newBoards[index] = { ...newBoards[index], [field]: value };
        setBoards(newBoards);
    };

    const resetForm = () => {
        setName('');
        setSysId('');
        setBoards(initialBoards);
        setError('');
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!name.trim()) {
            setError('Please enter a school name.');
            return;
        }

        if (!sysId.trim()) {
            setError('Please enter or extract a System ID.');
            return;
        }

        // Validate that at least one board (preferably Notice) has mi and bbsId
        const validBoards = boards.filter(b => b.mi.trim() !== '' && b.bbsId.trim() !== '');

        if (validBoards.length === 0) {
            setError('최소한 하나의 게시판(예: 공지사항) 주소를 입력해야 합니다.');
            return;
        }

        // Use the first valid board's mi/bbsId as fallback for the top level School properties
        const fallbackBoard = validBoards.find(b => b.id === 'notice') || validBoards[0];

        const newSchool: School = {
            id: sysId.trim(),
            name: name.trim(),
            sysId: sysId.trim(),
            mi: fallbackBoard.mi,
            bbsId: fallbackBoard.bbsId,
            boards: validBoards
        };

        onAdd(newSchool);
        resetForm();
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-xl font-semibold text-gray-800">Add School</h2>
                    <button onClick={() => { onClose(); resetForm(); }} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {error && (
                        <div className="p-3 mb-4 bg-red-50 text-red-600 text-sm rounded-md flex items-start gap-2">
                            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <form id="add-school-form" onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    School Name
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g. 청도중학교"
                                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    System ID
                                </label>
                                <input
                                    type="text"
                                    value={sysId}
                                    onChange={(e) => setSysId(e.target.value)}
                                    placeholder="e.g. cheongdoms (URL 붙여넣기 시 자동 추출됨)"
                                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        <div className="pt-2 border-t">
                            <h3 className="text-sm font-semibold text-gray-700 mb-4">게시판 설정 (최소 1개 이상 필수)</h3>
                            <div className="space-y-6">
                                {boards.map((board, index) => (
                                    <div key={board.id} className="p-4 bg-gray-50 border rounded-lg">
                                        <div className="flex items-center justify-between mb-3">
                                            <h4 className="font-medium text-gray-800">{board.name}</h4>
                                            {board.id === 'notice' && <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded">권장</span>}
                                        </div>

                                        <div className="mb-4">
                                            <input
                                                type="url"
                                                placeholder="https://school.gyo6.net/... 복사한 링크를 여기에 붙여넣으세요"
                                                onChange={(e) => handleUrlPaste(index, e.target.value)}
                                                className="w-full px-3 py-2 text-sm border border-blue-200 bg-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-xs"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">
                                                    Menu ID (mi)
                                                </label>
                                                <input
                                                    type="text"
                                                    value={board.mi}
                                                    onChange={(e) => handleBoardChange(index, 'mi', e.target.value)}
                                                    className="w-full px-3 py-2 text-sm border bg-gray-100/50 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">
                                                    Board ID (bbsId)
                                                </label>
                                                <input
                                                    type="text"
                                                    value={board.bbsId}
                                                    onChange={(e) => handleBoardChange(index, 'bbsId', e.target.value)}
                                                    className="w-full px-3 py-2 text-sm border bg-gray-100/50 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </form>
                </div>

                <div className="p-4 border-t bg-gray-50 flex justify-end gap-2 rounded-b-lg">
                    <button
                        type="button"
                        onClick={() => { onClose(); resetForm(); }}
                        className="px-4 py-2 text-gray-700 hover:bg-gray-200 bg-white border border-gray-300 rounded-md transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="add-school-form"
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                        <Check size={16} />
                        Add School
                    </button>
                </div>
            </div>
        </div>
    );
}

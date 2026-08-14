import { useState } from 'react';
import { X, Check } from 'lucide-react';
import { School, Board } from '@/types';
import { SCHOOLS } from '@/const/schools';

interface EditSchoolModalProps {
    isOpen: boolean;
    school: School | null;
    onClose: () => void;
    onSave: (updatedSchool: School) => void;
    onDelete?: (schoolId: string) => void;
}

export default function EditSchoolModal({ isOpen, school, onClose, onSave, onDelete }: EditSchoolModalProps) {
    // 부모가 key={school.id}로 마운트를 갈아끼우므로 초기값 한 번이면 충분하다.
    // 예전에는 효과 안에서 setState로 prop을 상태에 복사해 렌더가 한 번 더 돌았다.
    const [boards, setBoards] = useState<Board[]>(() =>
        school?.boards?.length
            ? structuredClone(school.boards)
            : school
              ? [{ id: 'notice', name: '공지사항', mi: school.mi, bbsId: school.bbsId }]
              : [],
    );

    const isDefaultSchool = school ? SCHOOLS.some(s => s.id === school.id) : false;

    if (!isOpen || !school) return null;

    const handleBoardChange = (index: number, field: keyof Board, value: string) => {
        const newBoards = [...boards];
        newBoards[index] = { ...newBoards[index], [field]: value };
        setBoards(newBoards);
    };

    const handleUrlPaste = (index: number, urlString: string) => {
        if (!urlString.trim()) return;
        try {
            const url = new URL(urlString);
            const mi = url.searchParams.get('mi');
            const bbsId = url.searchParams.get('bbsId');

            if (mi && bbsId) {
                const newBoards = [...boards];
                newBoards[index] = { ...newBoards[index], mi, bbsId };
                setBoards(newBoards);
            }
        } catch {
            // Ignore invalid URLs while typing
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Find notice board if exists to update the top-level mi/bbsId for backward compatibility
        const noticeBoard = boards.find(b => b.id === 'notice') || boards[0];

        const updatedSchool: School = {
            ...school,
            mi: noticeBoard ? noticeBoard.mi : school.mi,
            bbsId: noticeBoard ? noticeBoard.bbsId : school.bbsId,
            boards: boards
        };

        onSave(updatedSchool);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-xl font-semibold text-gray-800">
                        게시판 링크 수정 ({school.name})
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    <p className="text-sm text-gray-600 mb-6">
                        각 게시판의 고유 ID (<code>mi</code>, <code>bbsId</code>) 값을 수정할 수 있습니다.
                    </p>

                    <form id="edit-school-form" onSubmit={handleSubmit} className="space-y-6">
                        {boards.map((board, index) => (
                            <div key={board.id} className="p-4 bg-gray-50 border rounded-lg">
                                <h3 className="font-medium text-gray-800 mb-4">{board.name}</h3>

                                <div className="mb-4">
                                    <label className="block text-xs font-medium text-gray-500 mb-1">
                                        전체 링크 (URL) 붙여넣기 자동 입력
                                    </label>
                                    <input
                                        type="url"
                                        placeholder="https://school.gyo6.net/... 복사한 링크를 여기에 붙여넣으세요"
                                        onChange={(e) => handleUrlPaste(index, e.target.value)}
                                        className="w-full px-3 py-2 text-sm border border-blue-200 bg-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <p className="text-[10px] text-gray-500 mt-1">
                                        홈페이지에서 복사한 전체 주소를 붙여넣으면 아래 설정값이 자동으로 채워집니다.
                                    </p>
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
                                            required
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
                                            required
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </form>
                </div>

                <div className="p-4 border-t bg-gray-50 flex justify-between rounded-b-lg">
                    {onDelete && !isDefaultSchool ? (
                        <button
                            type="button"
                            onClick={() => {
                                if (window.confirm(`${school.name} 설정 정보를 삭제하시겠습니까?`)) {
                                    onDelete(school.id);
                                    onClose();
                                }
                            }}
                            className="px-4 py-2 text-red-600 hover:bg-red-50 bg-white border border-red-200 rounded-md transition-colors"
                        >
                            삭제
                        </button>
                    ) : (
                        <div></div>
                    )}
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 hover:bg-gray-200 bg-white border border-gray-300 rounded-md transition-colors"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            form="edit-school-form"
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
                        >
                            <Check size={16} />
                            저장하기
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

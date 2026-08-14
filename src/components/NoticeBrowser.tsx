'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { SCHOOLS } from '@/const/schools';
import { Notice, School } from '@/types';
import SchoolTabs from '@/components/SchoolTabs';
import NoticeList from '@/components/NoticeList';
import NoticeDetailModal from '@/components/NoticeDetailModal';
import AddSchoolModal from '@/components/AddSchoolModal';
import EditSchoolModal from '@/components/EditSchoolModal';
import PasswordModal from '@/components/PasswordModal';
import NotifyButton from '@/components/NotifyButton';
import { RefreshCw, Settings } from 'lucide-react';

interface Props {
    initialNotices: Notice[];
    initialTotalPages: number;
    initialSchoolId: string;
    initialBoardId: string;
    initialNttSn?: string;
}

const defaultBoardFor = (school: School | undefined): string => {
    const boards = school?.boards ?? [];
    if (boards.some((b) => b.id === 'notice')) return 'notice';
    return boards[0]?.id ?? 'notice';
};

export default function NoticeBrowser({
    initialNotices,
    initialTotalPages,
    initialSchoolId,
    initialBoardId,
    initialNttSn,
}: Props) {
    const [customSchools, setCustomSchools] = useState<School[]>([]);

    // 예전에는 state였다. setAllSchools가 매번 새 배열을 만들어 [allSchools]에 걸린 효과를
    // 다시 발화시켰고, 그 때문에 첫 로드마다 18개 게시판 상태 조회가 두 번 나갔다.
    const allSchools = useMemo(() => {
        const merged = SCHOOLS.map((s) => customSchools.find((c) => c.id === s.id) ?? s);
        const extras = customSchools.filter((c) => !SCHOOLS.some((s) => s.id === c.id));
        return [...merged, ...extras];
    }, [customSchools]);

    const [selectedSchoolId, setSelectedSchoolId] = useState(initialSchoolId);
    const [selectedBoardId, setSelectedBoardId] = useState(initialBoardId);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [searchInput, setSearchInput] = useState('');

    const [notices, setNotices] = useState<Notice[]>(initialNotices);
    const [totalPages, setTotalPages] = useState(initialTotalPages);
    const [loading, setLoading] = useState(false);

    // 알림을 눌러 들어온 경우 해당 공지를 바로 연다. 효과가 아니라 초기값으로 처리해
    // 첫 렌더에 이미 열린 상태가 되게 한다.
    const [selectedNotice, setSelectedNotice] = useState<Notice | null>(
        () => (initialNttSn ? (initialNotices.find((n) => n.id === initialNttSn) ?? null) : null),
    );

    const [isAddSchoolModalOpen, setIsAddSchoolModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [pendingAction, setPendingAction] = useState<'add' | 'edit' | null>(null);

    const [schoolStatus, setSchoolStatus] = useState<Record<string, Record<string, boolean>>>({});
    const [viewedBoards, setViewedBoards] = useState<Record<string, Record<string, number>>>({});

    // 서버가 이미 첫 화면을 그려 보냈으니 마운트 직후 같은 요청을 또 보내지 않는다.
    const skipNextFetch = useRef(true);
    // 늦게 도착한 응답이 최신 화면을 덮어쓰는 것을 막는 순번.
    const requestSeq = useRef(0);

    useEffect(() => {
        const saved = localStorage.getItem('customSchools');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // 비어 있으면 그대로 둔다. setCustomSchools 는 값이 같아도 새 배열 정체성을 만들고,
                // 그게 allSchools → fetchNotices → 목록 효과로 번져 목록과 게시판 상태를
                // 각각 한 번씩 더 조회하게 만든다(저장값이 "[]" 여도 발생했다).
                if (Array.isArray(parsed) && parsed.length > 0) setCustomSchools(parsed);
            } catch {
                console.error('customSchools 파싱 실패');
            }
        }

        const savedViewed = localStorage.getItem('viewedBoards');
        if (savedViewed) {
            try {
                const parsed = JSON.parse(savedViewed);
                if (parsed && typeof parsed === 'object') setViewedBoards(parsed);
            } catch {
                console.error('viewedBoards 파싱 실패');
            }
        }
    }, []);

    const fetchNotices = useCallback(
        async (schoolId: string, boardId: string, page: number, search: string, fresh = false) => {
            const school = allSchools.find((s) => s.id === schoolId);
            const board = school?.boards?.find((b) => b.id === boardId);
            if (!school) return;

            const seq = ++requestSeq.current;
            setLoading(true);

            try {
                const params = new URLSearchParams({
                    schoolId,
                    page: String(page),
                    search,
                    sysId: school.sysId,
                    mi: board?.mi ?? school.mi,
                    bbsId: board?.bbsId ?? school.bbsId,
                });

                if (fresh) params.set('fresh', '1'); // 새로고침 버튼 — 캐시 건너뛰고 학교 서버 직접 조회

                const res = await fetch(`/api/notices?${params}`);
                if (!res.ok) throw new Error(`목록 조회 실패 ${res.status}`);
                const data = await res.json();

                if (seq !== requestSeq.current) return; // 더 새로운 요청이 있다 — 이 응답은 버린다

                setNotices(data.notices);
                setTotalPages(data.pagination.totalPages);
                // currentPage는 여기서 되돌리지 않는다. 예전에는 응답값으로 덮어쓰다가
                // 늦은 응답이 페이지를 되감고, 그게 다시 조회를 부르는 무한 루프가 됐다.
            } catch (error) {
                if (seq !== requestSeq.current) return;
                console.error('공지 목록을 불러오지 못했습니다', error);
                setNotices([]);
            } finally {
                if (seq === requestSeq.current) setLoading(false);
            }
        },
        [allSchools],
    );

    useEffect(() => {
        if (skipNextFetch.current) {
            skipNextFetch.current = false;
            return;
        }
        fetchNotices(selectedSchoolId, selectedBoardId, currentPage, searchKeyword);
    }, [selectedSchoolId, selectedBoardId, currentPage, searchKeyword, fetchNotices]);

    useEffect(() => {
        const controller = new AbortController();

        fetch('/api/notices/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ schools: allSchools }),
            signal: controller.signal,
        })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => data && setSchoolStatus(data))
            .catch((error) => {
                if (error.name !== 'AbortError') console.error('게시판 상태 조회 실패', error);
            });

        return () => controller.abort();
    }, [allSchools]);

    const markBoardAsViewed = useCallback((schoolId: string, boardId: string) => {
        setViewedBoards((prev) => {
            const updated = {
                ...prev,
                [schoolId]: { ...(prev[schoolId] ?? {}), [boardId]: Date.now() },
            };
            return updated;
        });
    }, []);

    // localStorage 쓰기는 상태 갱신 함수 밖에서 한다 — updater는 순수해야 하고,
    // StrictMode에서 두 번 호출되면 쓰기도 두 번 일어난다.
    useEffect(() => {
        if (Object.keys(viewedBoards).length === 0) return;
        localStorage.setItem('viewedBoards', JSON.stringify(viewedBoards));
    }, [viewedBoards]);

    // 학교 전환에 필요한 상태를 한 핸들러에서 모두 바꾼다. 예전에는 효과가 게시판 ID를
    // 뒤늦게 되돌리는 바람에, 첫 번째 조회가 반드시 버려지는 값으로 나갔다.
    const handleSchoolSelect = useCallback(
        (schoolId: string) => {
            const boardId = defaultBoardFor(allSchools.find((s) => s.id === schoolId));
            setSelectedSchoolId(schoolId);
            setSelectedBoardId(boardId);
            setCurrentPage(1);
            setSearchKeyword('');
            setSearchInput('');
            markBoardAsViewed(schoolId, boardId);
        },
        [allSchools, markBoardAsViewed],
    );

    const handleBoardSelect = useCallback(
        (boardId: string) => {
            setSelectedBoardId(boardId);
            setCurrentPage(1);
            setSearchKeyword('');
            setSearchInput('');
            markBoardAsViewed(selectedSchoolId, boardId);
        },
        [selectedSchoolId, markBoardAsViewed],
    );

    const persistCustomSchools = useCallback((next: School[]) => {
        setCustomSchools(next);
        localStorage.setItem('customSchools', JSON.stringify(next));
    }, []);

    const handleAddSchool = useCallback(
        (newSchool: School) => {
            if (customSchools.some((s) => s.id === newSchool.id)) return;
            persistCustomSchools([...customSchools, newSchool]);
            setSelectedSchoolId(newSchool.id);
            setSelectedBoardId(defaultBoardFor(newSchool));
        },
        [customSchools, persistCustomSchools],
    );

    const handleEditSchool = useCallback(
        (updated: School) => {
            const index = customSchools.findIndex((s) => s.id === updated.id);
            const next =
                index >= 0
                    ? customSchools.map((s) => (s.id === updated.id ? updated : s))
                    : [...customSchools, updated];
            persistCustomSchools(next);
            // allSchools가 바뀌면 fetchNotices도 새로 만들어져 효과가 다시 돌면서 갱신된다.
        },
        [customSchools, persistCustomSchools],
    );

    const handleDeleteSchool = useCallback(
        (schoolId: string) => {
            const next = customSchools.filter((s) => s.id !== schoolId);
            persistCustomSchools(next);
            if (selectedSchoolId === schoolId) {
                const fallback = next[0]?.id ?? SCHOOLS[0].id;
                setSelectedSchoolId(fallback);
                setSelectedBoardId(defaultBoardFor(allSchools.find((s) => s.id === fallback)));
            }
        },
        [customSchools, persistCustomSchools, selectedSchoolId, allSchools],
    );

    const handleSearch = useCallback(
        (e: React.FormEvent) => {
            e.preventDefault();
            setSearchKeyword(searchInput);
            setCurrentPage(1);
        },
        [searchInput],
    );

    const handlePageChange = useCallback(
        (newPage: number) => {
            if (newPage >= 1 && newPage <= totalPages) setCurrentPage(newPage);
        },
        [totalPages],
    );

    const handlePasswordSuccess = useCallback(() => {
        setIsPasswordModalOpen(false);
        if (pendingAction === 'add') setIsAddSchoolModalOpen(true);
        else if (pendingAction === 'edit') setIsEditModalOpen(true);
    }, [pendingAction]);

    const currentSchool = allSchools.find((s) => s.id === selectedSchoolId);
    const currentBoardName =
        currentSchool?.boards?.find((b) => b.id === selectedBoardId)?.name ?? '공지사항';

    return (
        <main className="min-h-screen bg-gray-50 flex flex-col">
            <header className="bg-white shadow-sm sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        🏫<span className="text-blue-600">청도학교 정보</span>
                    </h1>
                    <NotifyButton />
                </div>
                <div className="max-w-5xl mx-auto px-4">
                    <SchoolTabs
                        schools={allSchools}
                        selectedSchoolId={selectedSchoolId}
                        onSelectSchool={handleSchoolSelect}
                        onAddSchool={() => {
                            setPendingAction('add');
                            setIsPasswordModalOpen(true);
                        }}
                        schoolStatus={schoolStatus}
                        viewedBoards={viewedBoards}
                    />
                </div>
            </header>

            <div className="flex-1 max-w-5xl mx-auto px-4 py-6 w-full">
                <form onSubmit={handleSearch} className="mb-6 flex gap-2">
                    <input
                        type="search"
                        placeholder="제목으로 검색..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        type="submit"
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                        검색
                    </button>
                </form>

                <div className="bg-white rounded-lg shadow min-h-[500px] p-4 flex flex-col">
                    {currentSchool?.boards && currentSchool.boards.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-6 border-b pb-4">
                            {currentSchool.boards.map((board) => (
                                <button
                                    key={board.id}
                                    onClick={() => handleBoardSelect(board.id)}
                                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                                        selectedBoardId === board.id
                                            ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent'
                                    }`}
                                >
                                    {board.name}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="flex items-center justify-between mb-4 mt-2">
                        <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                            <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded text-sm">
                                {currentSchool?.name}
                            </span>
                            {currentBoardName}
                            <button
                                onClick={() => {
                                    setPendingAction('edit');
                                    setIsPasswordModalOpen(true);
                                }}
                                className="ml-2 text-gray-400 hover:text-blue-600 transition-colors"
                                title="게시판 링크 수정"
                            >
                                <Settings size={16} />
                            </button>
                        </h2>
                        <button
                            onClick={() =>
                                fetchNotices(
                                    selectedSchoolId,
                                    selectedBoardId,
                                    currentPage,
                                    searchKeyword,
                                    true,
                                )
                            }
                            disabled={loading}
                            className="p-2 text-gray-700 hover:text-blue-700 transition-colors disabled:opacity-50"
                            title="새로고침"
                            aria-label="새로고침"
                        >
                            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>

                    <div className="flex-1">
                        <NoticeList notices={notices} loading={loading} onSelectNotice={setSelectedNotice} />
                    </div>

                    {notices.length > 0 && !loading && totalPages > 1 && (
                        <div className="flex justify-center items-center gap-2 mt-6 pt-4 border-t">
                            <button
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                                className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                이전
                            </button>
                            <span className="text-sm text-gray-800">
                                <strong className="text-gray-900">{currentPage}</strong> / {totalPages}
                            </span>
                            <button
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                다음
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* selectedNotice를 비워 언마운트시킨다 — 예전에는 isOpen만 꺼서
                모달이 낡은 상태를 든 채 세션 내내 살아 있었다. */}
            {selectedNotice && (
                <NoticeDetailModal
                    notice={selectedNotice}
                    isOpen
                    onClose={() => setSelectedNotice(null)}
                />
            )}

            <AddSchoolModal
                isOpen={isAddSchoolModalOpen}
                onClose={() => setIsAddSchoolModalOpen(false)}
                onAdd={handleAddSchool}
            />

            {/* key로 학교가 바뀔 때마다 다시 마운트시킨다 — 모달이 prop을 상태로 베껴 넣는
                동기화 효과를 없앨 수 있다. */}
            {isEditModalOpen && currentSchool && (
                <EditSchoolModal
                    key={currentSchool.id}
                    isOpen
                    school={currentSchool}
                    onClose={() => setIsEditModalOpen(false)}
                    onSave={handleEditSchool}
                    onDelete={handleDeleteSchool}
                />
            )}

            <PasswordModal
                isOpen={isPasswordModalOpen}
                onClose={() => setIsPasswordModalOpen(false)}
                onSuccess={handlePasswordSuccess}
            />
        </main>
    );
}

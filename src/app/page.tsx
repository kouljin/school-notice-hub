'use client';

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { SCHOOLS } from '@/const/schools';
import { Notice, School } from '@/types';
import SchoolTabs from '@/components/SchoolTabs';
import NoticeList from '@/components/NoticeList';
import NoticeDetailModal from '@/components/NoticeDetailModal';
import AddSchoolModal from '@/components/AddSchoolModal';
import EditSchoolModal from '@/components/EditSchoolModal';
import PasswordModal from '@/components/PasswordModal';
import { Loader2, Settings } from 'lucide-react';

// Simple client-side cache for notices
const noticeCache: Record<string, { data: any, timestamp: number }> = {};
const CACHE_TTL = 1000 * 60; // 1 minute client side cache

export default function Home() {
  const [customSchools, setCustomSchools] = useState<School[]>([]);
  const [allSchools, setAllSchools] = useState<School[]>(SCHOOLS);

  const [selectedSchoolId, setSelectedSchoolId] = useState(SCHOOLS[0].id);
  const [selectedBoardId, setSelectedBoardId] = useState('notice'); // default board id
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddSchoolModalOpen, setIsAddSchoolModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Password protection state
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<'add' | 'edit' | null>(null);

  // State for pagination and search
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchInput, setSearchInput] = useState(''); // input value

  // New notices indicator status
  const [schoolStatus, setSchoolStatus] = useState<Record<string, Record<string, boolean>>>({});

  useEffect(() => {
    // Load custom schools from localStorage
    const saved = localStorage.getItem('customSchools');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Basic validation/sanitization could go here
        if (Array.isArray(parsed)) {
          setCustomSchools(parsed);
        }
      } catch (e) {
        console.error('Failed to parse custom schools', e);
      }
    }
  }, []);

  useEffect(() => {
    // Merge default and custom schools
    // If a custom school has same ID as default, it should replace it
    const defaultSchools = SCHOOLS.map(s => {
      const customOverride = customSchools.find(c => c.id === s.id);
      return customOverride ? customOverride : s;
    });
    // Add custom schools that are not in default SCHOOLS
    const newCustomSchools = customSchools.filter(c => !SCHOOLS.some(s => s.id === c.id));

    setAllSchools([...defaultSchools, ...newCustomSchools]);
  }, [customSchools]);

  useEffect(() => {
    // Reset page and search when school changes
    setCurrentPage(1);
    setSearchKeyword('');
    setSearchInput('');
    // Reset board to notice or first available board when school changes
    const targetSchool = customSchools.find(s => s.id === selectedSchoolId) || SCHOOLS.find(s => s.id === selectedSchoolId);
    let initialBoardId = 'notice';
    if (targetSchool?.boards && targetSchool.boards.length > 0) {
      // if the target school has boards, but not 'notice', select the first one
      if (!targetSchool.boards.find(b => b.id === 'notice')) {
        initialBoardId = targetSchool.boards[0].id;
      }
    }

    // Only fetch if selectedSchoolId is valid. We don't fetch here if we just changed board because
    // the board id update will trigger a re-fetch in the other array if needed.
    // However, if we change school, we need to ensure the board id also changes.
    // If the board id is the SAME, the board id effect won't run, so we need to fetch here.
    if (selectedSchoolId) {
      setSelectedBoardId(initialBoardId);
      // fetchNotices is called by an effect observing selectedBoardId
    }
  }, [selectedSchoolId, customSchools]); // add customSchools if it updates slowly

  useEffect(() => {
    // Fetch new notice statuses for all schools
    const fetchStatuses = async () => {
      if (allSchools.length === 0) return;
      try {
        const response = await fetch('/api/notices/status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ schools: allSchools }),
        });
        if (response.ok) {
          const data = await response.json();
          setSchoolStatus(data);
        }
      } catch (error) {
        console.error('Failed to fetch school statuses', error);
      }
    };

    fetchStatuses();
  }, [allSchools]);

  useEffect(() => {
    // Fetch when board, page or searchKeyword changes
    if (selectedSchoolId && selectedBoardId) {
      fetchNotices(selectedSchoolId, selectedBoardId, currentPage, searchKeyword);
    }
  }, [selectedBoardId, currentPage, searchKeyword]);

  const fetchNotices = async (schoolId: string, boardId: string, page: number, search: string, forceRefresh = false) => {
    if (!schoolId || !boardId) return;

    setLoading(true);
    // Don't clear notices immediately to avoid flicker if we have cached data

    try {
      const params: any = { schoolId, boardId, page, search };

      const targetSchool = customSchools.find(s => s.id === schoolId) || SCHOOLS.find(s => s.id === schoolId);

      if (targetSchool) {
        const targetBoard = targetSchool.boards?.find(b => b.id === boardId);
        params.sysId = targetSchool.sysId;
        params.mi = targetBoard ? targetBoard.mi : targetSchool.mi;
        params.bbsId = targetBoard ? targetBoard.bbsId : targetSchool.bbsId;
      }

      const cacheKey = JSON.stringify(params);
      const cached = noticeCache[cacheKey];

      if (!forceRefresh && cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        setNotices(cached.data.notices);
        if (cached.data.pagination) {
          setTotalPages(cached.data.pagination.totalPages);
          setCurrentPage(cached.data.pagination.currentPage);
        }
        setLoading(false);
        return;
      }

      // If no cache hit, we can clear notices to show loading state properly
      if (!cached) {
        setNotices([]);
      }

      const response = await axios.get(`/api/notices`, { params });

      const responseData = response.data;
      noticeCache[cacheKey] = {
        data: responseData,
        timestamp: Date.now()
      };

      setNotices(responseData.notices);
      if (responseData.pagination) {
        setTotalPages(responseData.pagination.totalPages);
        setCurrentPage(responseData.pagination.currentPage);
      }
    } catch (error) {
      console.error('Failed to fetch notices:', error);
      setNotices([]); // clear on error
    } finally {
      setLoading(false);
    }
  };

  const handleSchoolSelect = useCallback((schoolId: string) => {
    setSelectedSchoolId(schoolId);
  }, []);

  const handleOpenAddSchoolModal = useCallback(() => {
    setPendingAction('add');
    setIsPasswordModalOpen(true);
  }, []);

  const handleOpenEditModal = useCallback(() => {
    setPendingAction('edit');
    setIsPasswordModalOpen(true);
  }, []);

  const handlePasswordSuccess = useCallback(() => {
    setIsPasswordModalOpen(false);
    if (pendingAction === 'add') {
      setIsAddSchoolModalOpen(true);
    } else if (pendingAction === 'edit') {
      setIsEditModalOpen(true);
    }
  }, [pendingAction]);

  const handleAddSchool = useCallback((newSchool: School) => {
    setCustomSchools(prev => {
      if (prev.some(s => s.id === newSchool.id)) return prev;
      const newCustomSchools = [...prev, newSchool];
      localStorage.setItem('customSchools', JSON.stringify(newCustomSchools));
      return newCustomSchools;
    });
    setSelectedSchoolId(newSchool.id);
  }, []);

  const handleEditSchool = useCallback((updatedSchool: School) => {
    setCustomSchools(prev => {
      // Find and update if exists, otherwise append
      const existingIndex = prev.findIndex(s => s.id === updatedSchool.id);
      let newCustomSchools;

      if (existingIndex >= 0) {
        newCustomSchools = [...prev];
        newCustomSchools[existingIndex] = updatedSchool;
      } else {
        newCustomSchools = [...prev, updatedSchool];
      }

      localStorage.setItem('customSchools', JSON.stringify(newCustomSchools));
      return newCustomSchools;
    });

    // Also trigger a refresh for the current board
    fetchNotices(updatedSchool.id, selectedBoardId, 1, searchKeyword, true);
  }, [selectedBoardId, searchKeyword]);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setSearchKeyword(searchInput);
    setCurrentPage(1); // Reset to page 1 on search
  }, [searchInput]);

  const handlePageChange = useCallback((newPage: number) => {
    setTotalPages(prevPages => {
      if (newPage >= 1 && newPage <= prevPages) {
        setCurrentPage(newPage);
      }
      return prevPages;
    })
  }, []);

  const handleNoticeSelect = useCallback((notice: Notice) => {
    setSelectedNotice(notice);
    setIsModalOpen(true);
  }, []);

  const selectedNoticeName = allSchools.find(s => s.id === selectedSchoolId)?.boards?.find(b => b.id === selectedBoardId)?.name || 'Notices';
  const targetSchoolForUI = allSchools.find(s => s.id === selectedSchoolId);

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            🏫<span className="text-blue-600">청도학교 정보</span>
          </h1>
        </div>
        <div className="max-w-4xl mx-auto px-4">
          <SchoolTabs
            schools={allSchools}
            selectedSchoolId={selectedSchoolId}
            onSelectSchool={handleSchoolSelect}
            onAddSchool={handleOpenAddSchoolModal}
            schoolStatus={schoolStatus}
          />
        </div>
      </header>

      <div className="flex-1 max-w-4xl mx-auto px-4 py-6 w-full">
        {/* Search Bar */}
        <form onSubmit={handleSearch} className="mb-6 flex gap-2">
          <input
            type="text"
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
          {/* Board Tabs (Pills) */}
          {targetSchoolForUI && targetSchoolForUI.boards && targetSchoolForUI.boards.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6 border-b pb-4">
              {targetSchoolForUI.boards.map(board => (
                <button
                  key={board.id}
                  onClick={() => {
                    setSelectedBoardId(board.id);
                    setCurrentPage(1); // Reset page on board change
                    setSearchKeyword('');
                    setSearchInput('');
                  }}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${selectedBoardId === board.id
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
              <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded text-sm">{targetSchoolForUI?.name}</span>
              {selectedNoticeName}
              <button
                onClick={handleOpenEditModal}
                className="ml-2 text-gray-400 hover:text-blue-600 transition-colors"
                title="게시판 링크 수정"
              >
                <Settings size={16} />
              </button>
            </h2>
            <button
              onClick={() => fetchNotices(selectedSchoolId, selectedBoardId, currentPage, searchKeyword, true)}
              className="p-2 text-gray-700 hover:text-blue-700 transition-colors"
              title="Refresh"
            >
              <Loader2 size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="flex-1">
            <NoticeList
              notices={notices}
              loading={loading}
              onSelectNotice={handleNoticeSelect}
            />
          </div>

          {/* Pagination Controls */}
          {notices.length > 0 && !loading && (
            <div className="flex justify-center items-center gap-2 mt-6 pt-4 border-t">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                이전
              </button>

              <span className="text-sm text-gray-800">
                Page <strong className="text-gray-900">{currentPage}</strong> of {totalPages}
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

      {selectedNotice && (
        <NoticeDetailModal
          notice={selectedNotice}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      )}

      <AddSchoolModal
        isOpen={isAddSchoolModalOpen}
        onClose={() => setIsAddSchoolModalOpen(false)}
        onAdd={handleAddSchool}
      />

      <EditSchoolModal
        isOpen={isEditModalOpen}
        school={targetSchoolForUI || null}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleEditSchool}
      />

      <PasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        onSuccess={handlePasswordSuccess}
      />
    </main>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { SCHOOLS } from '@/const/schools';
import { Notice, School } from '@/types';
import SchoolTabs from '@/components/SchoolTabs';
import NoticeList from '@/components/NoticeList';
import NoticeDetailModal from '@/components/NoticeDetailModal';
import AddSchoolModal from '@/components/AddSchoolModal';
import { Loader2 } from 'lucide-react';

// Simple client-side cache for notices
const noticeCache: Record<string, { data: any, timestamp: number }> = {};
const CACHE_TTL = 1000 * 60; // 1 minute client side cache

export default function Home() {
  const [customSchools, setCustomSchools] = useState<School[]>([]);
  const [allSchools, setAllSchools] = useState<School[]>(SCHOOLS);

  const [selectedSchoolId, setSelectedSchoolId] = useState(SCHOOLS[0].id);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddSchoolModalOpen, setIsAddSchoolModalOpen] = useState(false);

  // State for pagination and search
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchInput, setSearchInput] = useState(''); // input value

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
    setAllSchools([...SCHOOLS, ...customSchools]);
  }, [customSchools]);

  useEffect(() => {
    // Reset page and search when school changes
    setCurrentPage(1);
    setSearchKeyword('');
    setSearchInput('');
    // If selectedSchoolId is not in the new list (e.g. deleted), revert to first
    // But for now we don't delete. 
    // We only fetch if selectedSchoolId is valid.
    if (selectedSchoolId) {
      fetchNotices(selectedSchoolId, 1, '');
    }
  }, [selectedSchoolId]);

  useEffect(() => {
    // Fetch when page or searchKeyword changes (but NOT on initial render as the above effect handles it)
    if (selectedSchoolId) {
      fetchNotices(selectedSchoolId, currentPage, searchKeyword);
    }
  }, [currentPage, searchKeyword]);

  const fetchNotices = async (schoolId: string, page: number, search: string, forceRefresh = false) => {
    if (!schoolId) return;

    setLoading(true);
    // Don't clear notices immediately to avoid flicker if we have cached data

    try {
      const params: any = { schoolId, page, search };

      const targetSchool = [...SCHOOLS, ...customSchools].find(s => s.id === schoolId);

      if (targetSchool) {
        params.sysId = targetSchool.sysId;
        params.mi = targetSchool.mi;
        params.bbsId = targetSchool.bbsId;
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
    setIsAddSchoolModalOpen(true);
  }, []);

  const handleAddSchool = useCallback((newSchool: School) => {
    setAllSchools(prev => {
      if (prev.some(s => s.id === newSchool.id)) {
        alert('School already exists!');
        return prev;
      }
      return [...prev, newSchool];
    });
    setCustomSchools(prev => {
      if (prev.some(s => s.id === newSchool.id)) return prev;
      const newCustomSchools = [...prev, newSchool];
      localStorage.setItem('customSchools', JSON.stringify(newCustomSchools));
      return newCustomSchools;
    });
    setSelectedSchoolId(newSchool.id);
  }, []);

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

  const selectedSchoolName = allSchools.find(s => s.id === selectedSchoolId)?.name;

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            🏫 School Notice Hub
          </h1>
        </div>
        <div className="max-w-4xl mx-auto px-4">
          <SchoolTabs
            schools={allSchools}
            selectedSchoolId={selectedSchoolId}
            onSelectSchool={handleSchoolSelect}
            onAddSchool={handleOpenAddSchoolModal}
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">
              {selectedSchoolName} Notices
            </h2>
            <button
              onClick={() => fetchNotices(selectedSchoolId, currentPage, searchKeyword, true)}
              className="p-2 text-gray-500 hover:text-blue-600 transition-colors"
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

              <span className="text-sm text-gray-600">
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
    </main>
  );
}

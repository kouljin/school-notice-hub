'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { SCHOOLS } from '@/const/schools';
import { Notice, School } from '@/types';
import SchoolTabs from '@/components/SchoolTabs';
import NoticeList from '@/components/NoticeList';
import NoticeDetailModal from '@/components/NoticeDetailModal';
import AddSchoolModal from '@/components/AddSchoolModal';
import { Loader2 } from 'lucide-react';

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

  const fetchNotices = async (schoolId: string, page: number, search: string) => {
    if (!schoolId) return;

    setLoading(true);
    setNotices([]);

    try {
      const params: any = { schoolId, page, search };

      // If it's a custom school, we need to pass the params to the API
      // because the API only knows about hardcoded SCHOOLS.
      // We look up the school in our allSchools state.
      // Note: We need to ensure allSchools is up to date. Using functional state or ref is better if it changes often,
      // but here it changes rarely.
      // However, inside useEffect/callbacks, stale state might be an issue.
      // Let's assume allSchools is fresh enough or use a lookup.
      // Actually, we can just look at customSchools and SCHOOLS directly.
      const targetSchool = [...SCHOOLS, ...customSchools].find(s => s.id === schoolId);

      if (targetSchool) {
        params.sysId = targetSchool.sysId;
        params.mi = targetSchool.mi;
        params.bbsId = targetSchool.bbsId;
      }

      const response = await axios.get(`/api/notices`, { params });
      setNotices(response.data.notices);
      if (response.data.pagination) {
        setTotalPages(response.data.pagination.totalPages);
        setCurrentPage(response.data.pagination.currentPage);
      }
    } catch (error) {
      console.error('Failed to fetch notices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSchoolSelect = (schoolId: string) => {
    setSelectedSchoolId(schoolId);
  };

  const handleOpenAddSchoolModal = () => {
    setIsAddSchoolModalOpen(true);
  };

  const handleAddSchool = (newSchool: School) => {
    // Check if already exists
    if (allSchools.some(s => s.id === newSchool.id)) {
      alert('School already exists!');
      return;
    }

    const newCustomSchools = [...customSchools, newSchool];
    setCustomSchools(newCustomSchools);
    localStorage.setItem('customSchools', JSON.stringify(newCustomSchools));

    // Select the new school
    setSelectedSchoolId(newSchool.id);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchKeyword(searchInput);
    setCurrentPage(1); // Reset to page 1 on search
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handleNoticeSelect = (notice: Notice) => {
    setSelectedNotice(notice);
    setIsModalOpen(true);
  };

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
              onClick={() => fetchNotices(selectedSchoolId, currentPage, searchKeyword)}
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

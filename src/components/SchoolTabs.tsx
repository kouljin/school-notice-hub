import React from 'react';
import { SchoolConfig } from '@/const/schools';
import { Plus } from 'lucide-react';

interface SchoolTabsProps {
    schools: SchoolConfig[];
    selectedSchoolId: string;
    onSelectSchool: (schoolId: string) => void;
    onAddSchool: () => void;
    schoolStatus?: Record<string, Record<string, boolean>>;
    viewedBoards?: Record<string, Record<string, number>>;
}

const SchoolTabs = React.memo(function SchoolTabs({ schools, selectedSchoolId, onSelectSchool, onAddSchool, schoolStatus, viewedBoards }: SchoolTabsProps) {
    return (
        <div className="border-b border-gray-200">
            <div className="flex flex-wrap items-center">
                {schools.map((school) => {
                    const status = schoolStatus?.[school.id] ?? {};
                    const viewed = viewedBoards?.[school.id] ?? {};

                    // dot indicators: show full opacity if never viewed, half opacity if already viewed
                    const dots = [
                        { boardId: 'notice', color: 'bg-red-500', title: '새로운 공지사항' },
                        { boardId: 'family_letter', color: 'bg-yellow-400', title: '새로운 가정통신문' },
                        { boardId: 'eval_plan', color: 'bg-blue-500', title: '새로운 평가계획' },
                    ].filter(d => status[d.boardId]);

                    return (
                        <button
                            key={school.id}
                            onClick={() => onSelectSchool(school.id)}
                            className={`flex items-center gap-1 px-2.5 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${selectedSchoolId === school.id
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-400'
                                }`}
                        >
                            <span>{school.name}</span>
                            {/* Traffic light new notice indicators */}
                            {dots.length > 0 && (
                                <div className="flex flex-col gap-[2px] justify-center h-full">
                                    {dots.map(d => {
                                        // dim the dot if the user has already viewed the board
                                        const isViewed = !!viewed[d.boardId];
                                        return (
                                            <div
                                                key={d.boardId}
                                                className={`w-1.5 h-1.5 rounded-full ${d.color} transition-opacity ${isViewed ? 'opacity-40' : 'opacity-100'}`}
                                                title={isViewed ? `${d.title} (확인함)` : d.title}
                                            />
                                        );
                                    })}
                                </div>
                            )}
                        </button>
                    );
                })}
                <button
                    onClick={onAddSchool}
                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-full transition-colors"
                    title="학교 추가"
                >
                    <Plus size={16} />
                </button>
            </div>
        </div>
    );
});

export default SchoolTabs;

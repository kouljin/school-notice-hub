import React from 'react';
import { SchoolConfig } from '@/const/schools';
import { Plus } from 'lucide-react';

interface SchoolTabsProps {
    schools: SchoolConfig[];
    selectedSchoolId: string;
    onSelectSchool: (schoolId: string) => void;
    onAddSchool: () => void;
    schoolStatus?: Record<string, Record<string, boolean>>;
}

const SchoolTabs = React.memo(function SchoolTabs({ schools, selectedSchoolId, onSelectSchool, onAddSchool, schoolStatus }: SchoolTabsProps) {
    return (
        <div className="flex items-center border-b border-gray-200 overflow-x-auto no-scrollbar">
            <div className="flex">
                {schools.map((school) => (
                    <button
                        key={school.id}
                        onClick={() => onSelectSchool(school.id)}
                        className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${selectedSchoolId === school.id
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-400'
                            }`}
                    >
                        <span>{school.name}</span>
                        {/* Traffic light new notice indicators */}
                        {schoolStatus && schoolStatus[school.id] && (
                            <div className="flex flex-col gap-[2px] justify-center h-full ml-0.5">
                                {schoolStatus[school.id]['notice'] && <div className="w-1.5 h-1.5 rounded-full bg-red-500" title="새로운 공지사항" />}
                                {schoolStatus[school.id]['family_letter'] && <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" title="새로운 가정통신문" />}
                                {schoolStatus[school.id]['eval_plan'] && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" title="새로운 평가계획" />}
                            </div>
                        )}
                    </button>
                ))}
            </div>
            <button
                onClick={onAddSchool}
                className="ml-2 p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-full transition-colors"
                title="Add School"
            >
                <Plus size={18} />
            </button>
        </div>
    );
});

export default SchoolTabs;

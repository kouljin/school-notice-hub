import React from 'react';
import { SchoolConfig } from '@/const/schools';
import { Plus } from 'lucide-react';

interface SchoolTabsProps {
    schools: SchoolConfig[];
    selectedSchoolId: string;
    onSelectSchool: (schoolId: string) => void;
    onAddSchool: () => void;
}

const SchoolTabs = React.memo(function SchoolTabs({ schools, selectedSchoolId, onSelectSchool, onAddSchool }: SchoolTabsProps) {
    return (
        <div className="flex items-center border-b border-gray-200 overflow-x-auto no-scrollbar">
            <div className="flex">
                {schools.map((school) => (
                    <button
                        key={school.id}
                        onClick={() => onSelectSchool(school.id)}
                        className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${selectedSchoolId === school.id
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        {school.name}
                    </button>
                ))}
            </div>
            <button
                onClick={onAddSchool}
                className="ml-2 p-2 text-gray-400 hover:text-blue-600 hover:bg-gray-100 rounded-full transition-colors"
                title="Add School"
            >
                <Plus size={18} />
            </button>
        </div>
    );
});

export default SchoolTabs;

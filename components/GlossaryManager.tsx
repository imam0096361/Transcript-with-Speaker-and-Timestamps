import React, { useState, useEffect } from 'react';
import { TrashIcon } from './icons/TrashIcon';

export interface GlossaryTerm {
  term: string;
  definition: string;
}

interface GlossaryManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (glossary: GlossaryTerm[]) => void;
  initialGlossary: GlossaryTerm[];
}

export const GlossaryManager: React.FC<GlossaryManagerProps> = ({ isOpen, onClose, onSave, initialGlossary }) => {
  const [glossary, setGlossary] = useState<GlossaryTerm[]>(initialGlossary);
  const [newTerm, setNewTerm] = useState('');
  const [newDefinition, setNewDefinition] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setGlossary(initialGlossary);
      setError('');
      setNewTerm('');
      setNewDefinition('');
    }
  }, [isOpen, initialGlossary]);

  if (!isOpen) {
    return null;
  }
  
  const handleAddTerm = () => {
    if (!newTerm.trim() || !newDefinition.trim()) {
      setError('Both term and definition are required.');
      return;
    }
    if (glossary.some(g => g.term.toLowerCase() === newTerm.trim().toLowerCase())) {
        setError('This term already exists in the glossary.');
        return;
    }
    setGlossary([...glossary, { term: newTerm.trim(), definition: newDefinition.trim() }]);
    setNewTerm('');
    setNewDefinition('');
    setError('');
  };

  const handleDeleteTerm = (termToDelete: string) => {
    setGlossary(glossary.filter(g => g.term !== termToDelete));
  };
  
  const handleSave = () => {
    onSave(glossary);
  }

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 transition-opacity duration-300"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl border border-slate-200 flex flex-col"
        style={{ height: '70vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold text-slate-800 mb-4 flex-shrink-0">Glossary Manager</h2>
        <p className="text-sm text-slate-500 mb-4 flex-shrink-0">
          Define custom terms, names, or acronyms to improve transcription accuracy. The AI will use these definitions to ensure consistency.
        </p>

        {/* Add Term Form */}
        <div className="flex-shrink-0">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-2">
            <input
              type="text"
              value={newTerm}
              onChange={(e) => setNewTerm(e.target.value)}
              placeholder="Term (e.g., 'GenAI')"
              className="md:col-span-2 w-full bg-slate-100 border border-slate-300 rounded-md p-2 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <input
              type="text"
              value={newDefinition}
              onChange={(e) => setNewDefinition(e.target.value)}
              placeholder="Use this transcription/definition"
              className="md:col-span-2 w-full bg-slate-100 border border-slate-300 rounded-md p-2 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <button
              onClick={handleAddTerm}
              className="md:col-span-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Add Term
            </button>
          </div>
          {error && <p className="text-red-500 text-xs mb-4">{error}</p>}
        </div>
        
        {/* Glossary List */}
        <div className="flex-grow overflow-y-auto border-t border-b border-slate-200 my-4">
            {glossary.length === 0 ? (
                <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                    Your glossary is empty.
                </div>
            ) : (
                <ul className="divide-y divide-slate-200">
                    {glossary.map((g, index) => (
                    <li key={index} className="flex items-center justify-between p-3">
                        <div>
                            <p className="font-semibold text-slate-800">{g.term}</p>
                            <p className="text-sm text-slate-600">{g.definition}</p>
                        </div>
                        <button
                        onClick={() => handleDeleteTerm(g.term)}
                        className="p-2 rounded-full text-slate-400 hover:bg-red-100 hover:text-red-600 transition-colors"
                        title={`Delete term "${g.term}"`}
                        >
                            <TrashIcon />
                        </button>
                    </li>
                    ))}
                </ul>
            )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 mt-4 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-200 rounded-md hover:bg-slate-300 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-slate-800 rounded-md hover:bg-slate-900 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-slate-500"
          >
            Save & Close
          </button>
        </div>
      </div>
    </div>
  );
};

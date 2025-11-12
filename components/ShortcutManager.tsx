import React, { useState, useEffect, useCallback } from 'react';
import { ActionName, Shortcut, ShortcutMap } from '../App';
import { TrashIcon } from './icons/TrashIcon';

interface ShortcutManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (shortcuts: ShortcutMap) => void;
  initialShortcuts: ShortcutMap;
}

const ACTION_DEFINITIONS: { id: ActionName; label: string; group: 'General' | 'Formatting' }[] = [
    { id: 'toggleRecording', label: 'Start / Stop Recording', group: 'General' },
    { id: 'copyRaw', label: 'Copy Raw Transcript', group: 'General' },
    { id: 'copyFormatted', label: 'Copy Formatted Transcript', group: 'General' },
    { id: 'openGlossary', label: 'Open Glossary', group: 'General' },
    { id: 'openShortcuts', label: 'Open Shortcuts', group: 'General' },
    { id: 'formatJournalisticEnglish', label: 'Format: Journalistic (English)', group: 'Formatting' },
    { id: 'formatJournalisticBangla', label: 'Format: Journalistic (Bangla)', group: 'Formatting' },
    { id: 'formatInterview', label: 'Format: Interview', group: 'Formatting' },
    { id: 'formatRoundtable', label: 'Format: Roundtable', group: 'Formatting' },
    { id: 'formatAcademic', label: 'Format: Academic', group: 'Formatting' },
    { id: 'formatSimple', label: 'Format: Simple Transcript', group: 'Formatting' },
    { id: 'formatDetailed', label: 'Format: Detailed Transcript', group: 'Formatting' },
    { id: 'formatJson', label: 'Format: JSON', group: 'Formatting' },
    { id: 'formatText', label: 'Format: Plain Text', group: 'Formatting' },
    { id: 'formatMarkdown', label: 'Format: Markdown', group: 'Formatting' },
    { id: 'formatSrt', label: 'Format: SRT Subtitles', group: 'Formatting' },
];

const formatShortcut = (shortcut?: Shortcut): string => {
  if (!shortcut || !shortcut.key) return 'Not set';
  const parts: string[] = [];
  // Use '⌘' for Mac's metaKey, 'Ctrl' otherwise.
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  if (isMac ? shortcut.metaKey : shortcut.ctrlKey) {
    parts.push(isMac ? '⌘' : 'Ctrl');
  }
  if (shortcut.altKey) parts.push('Alt');
  if (shortcut.shiftKey) parts.push('Shift');
  
  // Handle special key names
  const keyMap: {[key: string]: string} = {
    'ArrowUp': '↑', 'ArrowDown': '↓', 'ArrowLeft': '←', 'ArrowRight': '→', ' ': 'Space'
  };

  parts.push(keyMap[shortcut.key] || shortcut.key.toUpperCase());
  return parts.join(' + ');
};

const ShortcutInput: React.FC<{
    value?: Shortcut;
    onChange: (shortcut: Shortcut) => void;
    onClear: () => void;
    hasConflict: boolean;
}> = ({ value, onChange, onClear, hasConflict }) => {
    const [isListening, setIsListening] = useState(false);

    useEffect(() => {
        if (!isListening) return;

        // Fix: Explicitly typing the event parameter 'e' as KeyboardEvent to resolve errors when accessing its properties.
        const handleKeyDown = (e: KeyboardEvent) => {
            e.preventDefault();
            e.stopPropagation();

            // Ignore modifier-only key presses
            if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
            
            onChange({
                key: e.key,
                ctrlKey: e.ctrlKey,
                metaKey: e.metaKey,
                altKey: e.altKey,
                shiftKey: e.shiftKey,
            });
            setIsListening(false);
        };

        const handleClickOutside = () => setIsListening(false);
        
        document.addEventListener('keydown', handleKeyDown, true);
        document.addEventListener('click', handleClickOutside, true);
        return () => {
            document.removeEventListener('keydown', handleKeyDown, true);
            document.removeEventListener('click', handleClickOutside, true);
        };
    }, [isListening, onChange]);

    return (
        <div className="flex items-center space-x-2">
            <button
                type="button"
                onClick={() => setIsListening(true)}
                className={`w-40 text-left px-3 py-1.5 text-sm rounded-md border transition-colors ${
                    isListening
                        ? 'bg-blue-100 border-blue-400 ring-2 ring-blue-300'
                        : hasConflict ? 'bg-red-100 border-red-400 text-red-700' : 'bg-slate-100 border-slate-300 hover:bg-slate-200'
                }`}
            >
                {isListening ? 'Press keys...' : formatShortcut(value)}
            </button>
            <button
                type="button"
                onClick={onClear}
                className="p-2 rounded-full text-slate-400 hover:bg-red-100 hover:text-red-600 transition-colors"
                title="Clear shortcut"
            >
                <TrashIcon />
            </button>
        </div>
    );
};

export const ShortcutManager: React.FC<ShortcutManagerProps> = ({ isOpen, onClose, onSave, initialShortcuts }) => {
    const [shortcuts, setShortcuts] = useState<ShortcutMap>(initialShortcuts);
    const [conflict, setConflict] = useState<Record<string, string>>({});

    useEffect(() => {
        if (isOpen) {
            setShortcuts(initialShortcuts);
        }
    }, [isOpen, initialShortcuts]);
    
    useEffect(() => {
        const newConflictMap: Record<string, string> = {};
        const seen: Map<string, string> = new Map();
        
        Object.entries(shortcuts).forEach(([actionId, shortcut]) => {
            if (!shortcut || !shortcut.key) return;
            const shortcutString = `${shortcut.key},${shortcut.ctrlKey},${shortcut.metaKey},${shortcut.altKey},${shortcut.shiftKey}`;
            if (seen.has(shortcutString)) {
                const existingActionId = seen.get(shortcutString)!;
                newConflictMap[actionId] = existingActionId;
                if (!newConflictMap[existingActionId]) {
                   newConflictMap[existingActionId] = actionId;
                }
            } else {
                seen.set(shortcutString, actionId);
            }
        });
        setConflict(newConflictMap);
    }, [shortcuts]);


    const handleShortcutChange = (actionId: ActionName, newShortcut: Shortcut) => {
        setShortcuts(prev => ({ ...prev, [actionId]: newShortcut }));
    };

    const handleClearShortcut = (actionId: ActionName) => {
        const newShortcuts = { ...shortcuts };
        delete newShortcuts[actionId];
        setShortcuts(newShortcuts);
    };

    const handleSave = () => {
      if(Object.keys(conflict).length > 0) return;
      onSave(shortcuts);
    };

    if (!isOpen) return null;

    const renderGroup = (groupName: string) => {
        const actionsInGroup = ACTION_DEFINITIONS.filter(a => a.group === groupName);
        return (
             <div key={groupName}>
                <h3 className="text-lg font-semibold text-slate-700 mt-4 mb-2 border-b pb-1">{groupName} Actions</h3>
                <ul className="space-y-2">
                    {actionsInGroup.map(({ id, label }) => (
                        <li key={id} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50">
                            <span className="text-sm text-slate-600">{label}</span>
                             <ShortcutInput
                                value={shortcuts[id]}
                                onChange={(sc) => handleShortcutChange(id, sc)}
                                onClear={() => handleClearShortcut(id)}
                                hasConflict={!!conflict[id]}
                            />
                        </li>
                    ))}
                </ul>
             </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 transition-opacity duration-300" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl border border-slate-200 flex flex-col" style={{ height: '80vh' }} onClick={(e) => e.stopPropagation()}>
                <h2 className="text-xl font-semibold text-slate-800 mb-4 flex-shrink-0">Keyboard Shortcuts</h2>
                {Object.keys(conflict).length > 0 && (
                    <div className="p-3 mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                       Conflicts detected! Please ensure each shortcut is unique before saving.
                    </div>
                )}
                <div className="flex-grow overflow-y-auto">
                    {renderGroup('General')}
                    {renderGroup('Formatting')}
                </div>
                <div className="flex justify-end space-x-3 mt-4 flex-shrink-0 border-t pt-4">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-200 rounded-md hover:bg-slate-300 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-slate-400">
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={Object.keys(conflict).length > 0}
                        className="px-4 py-2 text-sm font-medium text-white bg-slate-800 rounded-md hover:bg-slate-900 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:bg-slate-400 disabled:cursor-not-allowed"
                    >
                        Save & Close
                    </button>
                </div>
            </div>
        </div>
    );
};
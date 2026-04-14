import { useState, useEffect } from 'react';
import './App.css';

type ActionType = 'boomerang' | 'remove-audio' | 'reverse' | 'concat' | 'improve';

const actionLabels: Record<ActionType, string> = {
  'boomerang': '🔄 Boomerang',
  'reverse': '⏪ Reverse',
  'remove-audio': '🔇 Remove Audio',
  'concat': '🔗 Concatenate',
  'improve': '✨ Improve Quality'
};

function App() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  // רשימת הקבצים בסדר שהמשתמש קבע
  const [orderedFiles, setOrderedFiles] = useState<File[]>([]);
  const [actions, setActions] = useState<ActionType[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [progressMsg, setProgressMsg] = useState<string>('Processing...');

  // סנכרון רשימת הקבצים המסודרת בכל פעם שבוחרים קבצים חדשים
  useEffect(() => {
    setOrderedFiles(selectedFiles);
  }, [selectedFiles]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const filesArray = Array.from(event.target.files);
      setSelectedFiles(filesArray);
      setError(null);
    }
  };

  const toggleAction = (action: ActionType) => {
    setActions(prev => {
      // אם בחרנו Concat - הוא מבטל את כל השאר
      if (action === 'concat') {
        return prev.includes('concat') ? [] : ['concat'];
      }
      // אם בחרנו פעולה אחרת והיה Concat - הוא מתבטל
      const filtered = prev.filter(a => a !== 'concat');
      if (filtered.includes(action)) {
        return filtered.filter(a => a !== action);
      }
      return [...filtered, action];
    });
  };

  // לוגיקה לשינוי סדר (עובדת גם על פעולות וגם על קבצים)
  const moveItem = (index: number, direction: 'up' | 'down', type: 'actions' | 'files') => {
    const list = type === 'actions' ? [...actions] : [...orderedFiles];
    if (direction === 'up' && index > 0) {
      [list[index - 1], list[index]] = [list[index], list[index - 1]];
    } else if (direction === 'down' && index < list.length - 1) {
      [list[index + 1], list[index]] = [list[index], list[index + 1]];
    }
    
    if (type === 'actions') setActions(list as ActionType[]);
    else setOrderedFiles(list as File[]);
  };

const handleDrop = (index: number, type: 'actions' | 'files') => {
    if (draggedIndex === null || draggedIndex === index) return;
    
    // מפרידים את הלוגיקה כדי ש-TypeScript ידע בדיוק איזה סוג מערך אנחנו משנים
    if (type === 'actions') {
      const list = [...actions];
      const item = list.splice(draggedIndex, 1)[0];
      list.splice(index, 0, item);
      setActions(list);
    } else {
      const list = [...orderedFiles];
      const item = list.splice(draggedIndex, 1)[0];
      list.splice(index, 0, item);
      setOrderedFiles(list);
    }
    
    setDraggedIndex(null);
  };

  const handleUpload = async () => {
    setIsLoading(true);
    setError(null);
    const evtSource = new EventSource('http://localhost:3003/api/video/progress');
    evtSource.onmessage = (e) => setProgressMsg(e.data);

    const formData = new FormData();
    // שולחים את הקבצים לפי הסדר שהמשתמש קבע ב-UI
    orderedFiles.forEach(file => formData.append('videos', file));
    formData.append('actions', JSON.stringify(actions));

    try {
      const response = await fetch(`http://localhost:3003/api/video/pipeline`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error('Server error');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `video_studio_${Date.now()}.mp4`;
      a.click();
    } catch (err) {
      setError('Processing failed. Please try again.');
    } finally {
      evtSource.close();
      setIsLoading(false);
    }
  };

  const isConcatActive = actions.includes('concat');
  const hasOtherActions = actions.length > 0 && !isConcatActive;

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>🎬 Video Studio Pro</h1>
      </header>

      <div className="editor-card">
        <div className="action-selector">
          <h3>1. Select Action</h3>
          <div className="button-group">
            <button 
              className={isConcatActive ? 'active' : ''} 
              onClick={() => toggleAction('concat')}
              disabled={hasOtherActions}
            >🔗 Concatenate</button>
            
            {/* שאר הכפתורים */}
            {(['boomerang', 'reverse', 'remove-audio', 'improve'] as ActionType[]).map(type => (
              <button
                key={type}
                className={actions.includes(type) ? 'active' : ''}
                onClick={() => toggleAction(type)}
                disabled={isConcatActive}
              >{actionLabels[type]}</button>
            ))}
          </div>
          <p className="info-text">
            {isConcatActive ? "💡 Concatenation is a standalone process and cannot be combined." : 
             hasOtherActions ? "💡 You can chain these actions, but Concatenate must be done separately." : ""}
          </p>
        </div>

        {/* Pipeline דינמי */}
        {(isConcatActive ? orderedFiles.length > 1 : actions.length > 0) && (
          <div className="pipeline-container">
            <h3>2. {isConcatActive ? 'Video Order' : 'Execution Order'}</h3>
            <ul className="pipeline-list">
              {(isConcatActive ? orderedFiles : actions).map((item, idx) => (
                <li 
                  key={item instanceof File ? item.name + idx : item}
                  className="pipeline-item"
                  draggable
                  onDragStart={() => setDraggedIndex(idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(idx, isConcatActive ? 'files' : 'actions')}
                >
                  <div className="item-left">
                    <span className="step-number">{idx + 1}</span>
                    <span className="action-name">
                      {item instanceof File ? item.name : actionLabels[item as ActionType]}
                    </span>
                  </div>
                  <div className="item-controls">
                    <button onClick={() => moveItem(idx, 'up', isConcatActive ? 'files' : 'actions')} disabled={idx === 0}>⬆️</button>
                    <button onClick={() => moveItem(idx, 'down', isConcatActive ? 'files' : 'actions')} disabled={idx === (isConcatActive ? orderedFiles.length : actions.length) - 1}>⬇️</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="upload-section">
          <h3>{isConcatActive || actions.length > 0 ? '3.' : '2.'} Upload Files</h3>
          <label className="file-label">
            <input type="file" accept="video/*" multiple={isConcatActive} onChange={handleFileChange} disabled={isLoading} />
            {isConcatActive ? 'Select Multiple Videos' : 'Select Video'}
          </label>
        </div>

        {error && <div className="error-message">{error}</div>}

        <button className="submit-btn" onClick={handleUpload} disabled={selectedFiles.length === 0 || actions.length === 0 || isLoading}>
          {isLoading ? <span className="spinner">⏳ {progressMsg}</span> : 'Start Editing 🚀'}
        </button>
      </div>
    </div>
  );
}

export default App;
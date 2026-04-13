import { useState, useEffect, useRef } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import './App.css';

type ActionType = 'boomerang' | 'remove-audio' | 'reverse' | 'concat' | 'improve';

const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

// מגבלות הדפדפן - שונות מאוד בין מחשב לטלפון!
const LOCAL_MAX_SIZES_MB: Record<ActionType, number> = {
  // בטלפון כמעט בלתי אפשרי לעשות היפוך, לכן נגביל ל-1MB (ואולי יעדיפו להשתמש בשרת)
  'boomerang': isMobile ? 1 : 15,
  'reverse': isMobile ? 1 : 15,
  'improve': isMobile ? 10 : 50,
  // פעולות העתקה (Copy) לא תופסות זיכרון, אז אפשר לתת להן גבול גבוה גם בטלפון
  'concat': isMobile ? 50 : 100, 
  'remove-audio': isMobile ? 50 : 100
};

  const actionLabels: Record<ActionType, string> = {
    'boomerang': '🔄 Boomerang',
    'reverse': '⏪ Reverse',
    'remove-audio': '🔇 Remove Audio',
    'concat': '🔗 Concatenate',
    'improve': '✨ Improve Quality'
  };

  const MAX_FILE_SIZES_MB: Record<ActionType, number> = {
    'boomerang': 2,
    'reverse': 2,
    'improve': 10,
    'concat': 15,
    'remove-audio': 20
  };

const API_BASE_URL = import.meta.env.DEV 
  ? 'http://localhost:3003' 
  : 'https://media-editing-api.onrender.com';

function App() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  // רשימת הקבצים בסדר שהמשתמש קבע
  const [orderedFiles, setOrderedFiles] = useState<File[]>([]);
  const [actions, setActions] = useState<ActionType[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [progressMsg, setProgressMsg] = useState<string>('Processing...');
  const ffmpegRef = useRef(new FFmpeg());


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

  const isConcatActive = actions.includes('concat');
  const hasOtherActions = actions.length > 0 && !isConcatActive;

  const processLocally = async (actionToRun: ActionType) => {
    if (orderedFiles.length === 0) return;
    
    setIsLoading(true);
    setError(null);
    const ffmpeg = ffmpegRef.current;

    try {
      if (!ffmpeg.loaded) {
        setProgressMsg('⬇️ Downloading local engine (approx 25MB)...');
        await ffmpeg.load();
      }

      setProgressMsg('🚀 Processing locally in your browser...');
      
      ffmpeg.on('progress', ({ progress }) => {
        setProgressMsg(`🚀 Processing locally: ${Math.round(progress * 100)}%`);
      });

      const outputName = 'output.mp4';
      let ffmpegArgs: string[] = [];

      // טיפול מיוחד בחיבור סרטונים (טוען את כולם ויוצר קובץ רשימה)
      if (actionToRun === 'concat') {
        let listContent = '';
        for (let i = 0; i < orderedFiles.length; i++) {
          const fileName = `input${i}.mp4`;
          await ffmpeg.writeFile(fileName, await fetchFile(orderedFiles[i]));
          listContent += `file '${fileName}'\n`;
        }
        await ffmpeg.writeFile('list.txt', listContent);
        // שימוש ב-demuxer: מחבר סרטונים תוך שניות בלי לקדד מחדש (הכי חסכוני בזיכרון!)
        ffmpegArgs = ['-f', 'concat', '-safe', '0', '-i', 'list.txt', '-c', 'copy', outputName];
      } 
      else {
        // שאר הפעולות דורשות רק קובץ אחד
        const inputName = 'input.mp4';
        await ffmpeg.writeFile(inputName, await fetchFile(orderedFiles[0]));

        switch (actionToRun) {
          case 'remove-audio':
            ffmpegArgs = ['-i', inputName, '-c:v', 'copy', '-an', outputName];
            break;
          case 'reverse':
            ffmpegArgs = ['-i', inputName, '-filter_complex', '[0:v]scale=-2:480,reverse[v]', '-map', '[v]', outputName];
            break;
          case 'boomerang':
            ffmpegArgs = ['-i', inputName, '-filter_complex', '[0:v]scale=-2:480[vsmall];[vsmall]reverse[r];[vsmall][r]concat=n=2:v=1[v]', '-map', '[v]', outputName];
            break;
          case 'improve':
            // משפר ניגודיות ומוסיף חידוד (Unsharp Mask)
            ffmpegArgs = ['-i', inputName, '-vf', 'eq=contrast=1.2:brightness=0.05,unsharp=5:5:1.0', '-c:a', 'copy', outputName];
            break;
        }
      }

      await ffmpeg.exec(ffmpegArgs);

      const fileData = await ffmpeg.readFile(outputName);
      const blob = new Blob([fileData as any], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `video_studio_local_${Date.now()}.mp4`;
      a.click();

    } catch (err) {
      console.error(err);
      // הודעת שגיאה חכמה שיודעת אם המשתמש בטלפון או במחשב
      const deviceName = isMobile ? 'phone' : 'computer';
      setError(`❌ Local processing failed. Your ${deviceName}'s browser likely ran out of memory. Try a shorter video!`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpload = async () => {
    if (orderedFiles.length === 0) return; 

    // --- מערכת הגנה וניתוב (Two-Tier Routing) ---
    if (isConcatActive) {
      const totalSize = orderedFiles.reduce((sum, file) => sum + file.size, 0);
      const serverLimitBytes = MAX_FILE_SIZES_MB['concat'] * 1024 * 1024;
      const localLimitBytes = LOCAL_MAX_SIZES_MB['concat'] * 1024 * 1024;
      
      // 1. קודם כל בודקים אם זה בכלל אפשרי בדפדפן (חסימה מוחלטת)
      if (totalSize > localLimitBytes) {
        setError(`⚠️ The files are too large (${(totalSize / (1024*1024)).toFixed(1)}MB). The maximum allowed for concatenation is ${LOCAL_MAX_SIZES_MB['concat']}MB.`);
        return;
      }

      // 2. אם זה גדול לשרת, אבל מותר בדפדפן - ננתב למקומי
      if (totalSize > serverLimitBytes) {
        console.log("Routing to local WASM processing...");
        await processLocally('concat');
        return; 
      }
    } else {
      const strictestAction = actions.reduce((prev, curr) => 
        MAX_FILE_SIZES_MB[curr] < MAX_FILE_SIZES_MB[prev] ? curr : prev
      );
      
      const serverLimitBytes = MAX_FILE_SIZES_MB[strictestAction] * 1024 * 1024;
      const localLimitBytes = LOCAL_MAX_SIZES_MB[strictestAction] * 1024 * 1024;
      const fileSize = orderedFiles[0].size;
      const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(1);

      // 1. חסימה קשיחה למניעת קריסת הדפדפן
      if (fileSize > localLimitBytes) {
        setError(`⚠️ The '${actionLabels[strictestAction]}' action is limited to videos up to ${LOCAL_MAX_SIZES_MB[strictestAction]}MB. Your video is ${fileSizeMB}MB.`);
        return;
      }

      // 2. ניתוב למקומי אם גדול מדי לשרת
      if (fileSize > serverLimitBytes) {
        console.log("Routing to local WASM processing...");
        await processLocally(actions[0]);
        return; 
      }
    }
    // ---------------------------------------------
    setIsLoading(true);
    setError(null);
    const evtSource = new EventSource(`${API_BASE_URL}/api/video/progress`);
    evtSource.onmessage = (e) => setProgressMsg(e.data);

    const formData = new FormData();
    // שולחים את הקבצים לפי הסדר שהמשתמש קבע ב-UI
    orderedFiles.forEach(file => formData.append('videos', file));
    formData.append('actions', JSON.stringify(actions));

    try {
      const response = await fetch(`${API_BASE_URL}/api/video/pipeline`, {
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
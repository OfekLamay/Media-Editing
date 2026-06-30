import { useState, useEffect, useRef } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import './App.css';

type ActionType = 'boomerang' | 'remove-audio' | 'reverse' | 'concat' | 'improve' | 'speed' | 'trim';

const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

const LOCAL_MAX_SIZES_MB: Record<ActionType, number> = {
  'boomerang': isMobile ? 2.5 : 15,
  'reverse': isMobile ? 2.5 : 15,
  'improve': isMobile ? 10 : 50,
  'concat': isMobile ? 50 : 100, 
  'remove-audio': isMobile ? 50 : 100,
  'speed': isMobile ? 50 : 100,
  'trim': isMobile ? 50 : 100
};

  const actionLabels: Record<ActionType, string> = {
    'boomerang': '🔄 Boomerang',
    'reverse': '⏪ Reverse',
    'remove-audio': '🔇 Remove Audio',
    'concat': '🔗 Concatenate',
    'improve': '✨ Improve Quality',
    'speed': '⏱️ Change Speed',
    'trim': '✂️ Trim Video'
  };

  const CLOUD_MAX_FILE_SIZES_MB: Record<ActionType, number> = {
    'boomerang': 2,
    'reverse': 2,
    'improve': 10,
    'concat': 15,
    'remove-audio': 20,
    'speed': 15,
    'trim': 15
  };

  const DEV_UNLIMITED_SIZES_MB: Record<ActionType, number> = {
  'boomerang': 9999,
  'reverse': 9999,
  'improve': 9999,
  'concat': 9999,
  'remove-audio': 9999,
  'speed': 9999,
  'trim': 9999
};

const MAX_FILE_SIZES_MB = import.meta.env.DEV 
  ? DEV_UNLIMITED_SIZES_MB
  : CLOUD_MAX_FILE_SIZES_MB;

const API_BASE_URL = import.meta.env.DEV 
  ? 'http://localhost:3003' 
  : 'https://media-editing-api.onrender.com';

function App() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  // Files order for concatenation or actions order for processing
  const [orderedFiles, setOrderedFiles] = useState<File[]>([]);
  const [actions, setActions] = useState<ActionType[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [progressMsg, setProgressMsg] = useState<string>('Processing...');
  const [speedFactor, setSpeedFactor] = useState<string>("1.5");
  const [trimStart, setTrimStart] = useState<number>(0);
  const [trimDuration, setTrimDuration] = useState<number>(5);
  const ffmpegRef = useRef(new FFmpeg());


  // Sync the ordered files after changes
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
      // Choosing concat cancels all other actions and vice versa
      if (action === 'concat') {
        return prev.includes('concat') ? [] : ['concat'];
      }
      const filtered = prev.filter(a => a !== 'concat');
      if (filtered.includes(action)) {
        return filtered.filter(a => a !== action);
      }
      return [...filtered, action];
    });
  };

  // Actions and files can be reordered by the user
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
    
    // Consolidated logic for both actions and files reordering using drag-and-drop
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

      // Concatenation is a special case that requires multiple files and a list input, while other actions work on a single file
      if (actionToRun === 'concat') {
        let listContent = '';
        for (let i = 0; i < orderedFiles.length; i++) {
          const fileName = `input${i}.mp4`;
          await ffmpeg.writeFile(fileName, await fetchFile(orderedFiles[i]));
          listContent += `file '${fileName}'\n`;
        }
        await ffmpeg.writeFile('list.txt', listContent);
        // Using concat demuxer for lossless concatenation, which is very fast and efficient
        ffmpegArgs = ['-f', 'concat', '-safe', '0', '-i', 'list.txt', '-c', 'copy', outputName];
      } 
      else {
        // All other actions only process the first file in the ordered list
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
            // Unsharp and contrast filters for a quick quality boost, without re-encoding the audio
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
      // Error handling for local processing - likely due to memory limits in the browser, especially on mobile devices. We provide a user-friendly message suggesting a possible cause and solution.
      const deviceName = isMobile ? 'phone' : 'computer';
      setError(`❌ Local processing failed. Your ${deviceName}'s browser likely ran out of memory. Try a shorter video!`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpload = async () => {
    if (orderedFiles.length === 0) return; 

    // --- Routing Logic ---
    if (isConcatActive) {
      const totalSize = orderedFiles.reduce((sum, file) => sum + file.size, 0);
      const serverLimitBytes = MAX_FILE_SIZES_MB['concat'] * 1024 * 1024;
      const localLimitBytes = LOCAL_MAX_SIZES_MB['concat'] * 1024 * 1024;
      
      // Does the total size exceed the server limit for concatenation?
      if (totalSize > serverLimitBytes) {
        // Too much for the server, but still fits within the local browser limit
        if (totalSize <= localLimitBytes) {
          console.log("Routing to local WASM processing...");
          await processLocally('concat');
          return;
        } else {
          // Too large for both the server and the browser - error
          setError(`⚠️ The files are too large (${(totalSize / (1024*1024)).toFixed(1)}MB). The maximum allowed for concatenation is ${MAX_FILE_SIZES_MB['concat']}MB.`);
          return;
        }
      }
      // If we've reached here, the file is smaller than serverLimitBytes, and it will simply continue to upload to the server!
      
    } else {
      const strictestAction = actions.reduce((prev, curr) => 
        MAX_FILE_SIZES_MB[curr] < MAX_FILE_SIZES_MB[prev] ? curr : prev
      );
      
      const serverLimitBytes = MAX_FILE_SIZES_MB[strictestAction] * 1024 * 1024;
      const localLimitBytes = LOCAL_MAX_SIZES_MB[strictestAction] * 1024 * 1024;
      const fileSize = orderedFiles[0].size;
      const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(1);

      // Does the file size exceed the server limit for the selected action?
      if (fileSize > serverLimitBytes) {
        // If it's too large for the server but fits within the local browser limit
        if (fileSize <= localLimitBytes) {
          console.log("Routing to local WASM processing...");
          await processLocally(actions[0]);
          return; 
        } else {
          // Too large for both the server and the browser
          setError(`⚠️ The '${actionLabels[strictestAction]}' action is limited to videos up to ${MAX_FILE_SIZES_MB[strictestAction]}MB. Your video is ${fileSizeMB}MB.`);
          return;
        }
      }
      // Will continue to upload...
    }
    // ---------------------------------------------
    setIsLoading(true);
    setError(null);
    
    // Create a unique job ID for this processing session, which will be used to track progress on the server side and provide real-time updates to the user.
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Link to the server-side progress updates via Server-Sent Events (SSE).
    // This allows the frontend to receive real-time progress messages from the backend as the video processing occurs, enhancing user experience by keeping them informed.
    const evtSource = new EventSource(`${API_BASE_URL}/api/video/progress?jobId=${jobId}`);
    evtSource.onmessage = (e) => setProgressMsg(e.data);

    const formData = new FormData();
    // Process the files in the user-defined order for concatenation, or just send the single file for other actions. The backend will determine how to handle them based on the selected actions.

    orderedFiles.forEach(file => formData.append('videos', file));
    formData.append('actions', JSON.stringify(actions));
    formData.append('jobId', jobId); // Add the jobId to the form data so the backend can associate this request with the correct progress updates.
    
    if (actions.includes('speed')) {
      formData.append('speedFactor', speedFactor);
    }
    if (actions.includes('trim')) {
      formData.append('trimStart', trimStart.toString());
      formData.append('trimDuration', trimDuration.toString());
    }

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
            
            {(['boomerang', 'reverse', 'remove-audio', 'improve', 'speed', 'trim'] as ActionType[]).map(type => (
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
        {(actions.includes('speed') || actions.includes('trim')) && (
          <div className="action-settings" style={{ background: '#f7fafc', padding: '15px', borderRadius: '8px', marginBottom: '2rem', border: '1px solid #e2e8f0' }}>
            <h4 style={{ marginTop: 0, color: '#2c3e50' }}>⚙️ Action Settings</h4>
            
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              {actions.includes('speed') && (
                <div className="setting-group" style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Video Speed:</label>
                  <select 
                    value={speedFactor} 
                    onChange={(e) => setSpeedFactor(e.target.value)}
                    style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e0' }}
                  >
                    <option value="0.5">Slower (0.5x)</option>
                    <option value="0.66">Slower (0.66x)</option>
                    <option value="1.5">Faster (1.5x)</option>
                    <option value="2">Faster (2.0x)</option>
                  </select>
                </div>
              )}

              {actions.includes('trim') && (
                <>
                  <div className="setting-group" style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Start Time (seconds):</label>
                    <input 
                      type="number" 
                      min="0"
                      value={trimStart} 
                      onChange={(e) => setTrimStart(Number(e.target.value))}
                      style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e0', width: '120px' }}
                    />
                  </div>
                  <div className="setting-group" style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Duration (seconds):</label>
                    <input 
                      type="number" 
                      min="1"
                      value={trimDuration} 
                      onChange={(e) => setTrimDuration(Number(e.target.value))}
                      style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e0', width: '120px' }}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        )}

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
export const api = {
  readExcel: async (path: string) => {
    const res = await fetch('/api/fs/read-excel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path })
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to read Excel');
    }
    return res.json();
  },

  listDirectory: async (path?: string) => {
    const res = await fetch('/api/fs/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path })
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to list directory');
    }
    return res.json();
  },

  uploadManifest: async (file: File, corpus: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('corpus', corpus);
    
    const res = await fetch('/api/upload/manifest', {
      method: 'POST',
      body: formData
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to upload manifest');
    }
    return res.json();
  },

  uploadPDFs: async (files: FileList, corpus: string) => {
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
    }
    formData.append('corpus', corpus);

    const res = await fetch('/api/upload/pdfs', {
        method: 'POST',
        body: formData
    });
    if (!res.ok) throw new Error('Failed to upload PDFs');
    return res.json();
  },

  testAI: async (apiKey: string) => {
    const res = await fetch('/api/ai/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey })
    });
    const data = await res.json();
    return data.success;
  },

  startPipeline: async (config: any) => {
    const res = await fetch('/api/pipeline/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    return res.json();
  },

  getResults: async () => {
    const res = await fetch('/api/results');
    return res.json();
  },

  exportFile: async (content: string, filename: string) => {
    await fetch('/api/fs/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, filename })
    });
  },

  subscribeToLogs: (callback: (msg: string) => void) => {
    const evtSource = new EventSource('/api/stream');
    evtSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      callback(data.message);
    };
    return () => evtSource.close();
  }
};

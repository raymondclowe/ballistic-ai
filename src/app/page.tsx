'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Layout from '../components/Layout';
import { useProjectDir } from '../hooks/useProjectDir';

const ChatInterface = dynamic(() => import('../components/ChatInterface'), { ssr: false });
const FileList = dynamic(() => import('../components/FileList'), { ssr: false });
const APIKeyManager = dynamic(() => import('../components/APIKeyManager'), { ssr: false });

export default function Home() {
  const { projectDir, loading, error } = useProjectDir();
  const [includePaths, setIncludePaths] = useState<string[]>([]);
  const [isStarted, setIsStarted] = useState(false);
  const [hasBackup, setHasBackup] = useState(false);
  const [systemMessages, setSystemMessages] = useState<{ type: string; content: string }[]>([]);
  const [fileListKey, setFileListKey] = useState(0);

  useEffect(() => {
    if (projectDir) {
      fetchIncludePaths();
    }
  }, [projectDir]);

  const fetchIncludePaths = async () => {
    try {
      const response = await fetch(`/api/context-settings?projectDir=${encodeURIComponent(projectDir)}`);
      if (response.ok) {
        const settings = await response.json();
        setIncludePaths(settings.includePaths);
      }
    } catch (error) {
      console.error('Error fetching include paths:', error);
    }
  };

  const handleSettingsUpdate = (newIncludePaths: string[]) => {
    setIncludePaths(newIncludePaths);
  };

  const handleStart = useCallback(async () => {
    if (!projectDir) return;

    console.log('Start button clicked. Current state:', { isStarted, hasBackup, projectDir });
    setIsStarted(true);
    setSystemMessages([]); // Clear previous system messages
    console.log('isStarted set to true');

    try {
      // Create backup
      console.log('Creating backup...');
      const backupResponse = await fetch('/api/project-backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectDir }),
      });
      const backupData = await backupResponse.json();
      if (backupResponse.ok) {
        setHasBackup(true);
        setSystemMessages(prev => [...prev, { type: 'backup', content: 'Project backup created successfully.' }]);
        console.log('Backup created successfully:', backupData.message);
      } else {
        throw new Error(backupData.error || 'Failed to create backup');
      }

      // Analyze project
      await analyzeProject();

      console.log('Project started successfully. Current state:', { isStarted: true, hasBackup: true });
    } catch (error) {
      console.error('Error starting project:', error);
      setIsStarted(false);
      setSystemMessages(prev => [...prev, { type: 'error', content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]);
      console.log('Project start failed. isStarted set back to false.');
    }
  }, [projectDir]);

  const analyzeProject = async () => {
    console.log('Analyzing project...');
    const analyzeResponse = await fetch('/api/analyze-project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectDir }),
    });
    const analyzeData = await analyzeResponse.json();
    setSystemMessages(prev => [...prev, { type: 'analysis', content: analyzeData.message }]);
    console.log('Analyze project response:', analyzeData);

    // Refresh file list after analysis
    setFileListKey(prevKey => prevKey + 1);
  };

  const handleRestore = useCallback(async () => {
    if (!hasBackup || !projectDir) return;

    const confirmed = window.confirm(
      'Are you sure you want to restore the project to the latest backup? This will replace your current project with the backup.'
    );
    if (!confirmed) return;

    try {
      console.log('Restoring project...');
      const response = await fetch('/api/project-backup', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectDir }),
      });
      const data = await response.json();
      if (response.ok) {
        setIsStarted(false);
        setHasBackup(false);
        setSystemMessages(prev => [...prev, { type: 'restore', content: 'Project restored successfully.' }]);
        console.log('Project restored successfully');
        // Refresh file list after restoration
        setFileListKey(prevKey => prevKey + 1);
      } else {
        throw new Error(data.error || 'Failed to restore backup');
      }
    } catch (error) {
      console.error('Error restoring backup:', error);
      setSystemMessages(prev => [...prev, { type: 'error', content: `Error restoring backup: ${error instanceof Error ? error.message : 'Unknown error'}` }]);
    }
  }, [hasBackup, projectDir]);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 h-screen flex flex-col">
        <h1 className="text-2xl font-bold mb-4">Superhero</h1>
        {loading ? (
          <p>Loading project directory...</p>
        ) : error ? (
          <p className="text-red-500">Error: {error.message}</p>
        ) : (
          <>
            <p className="mb-2">Project Directory: {projectDir}</p>
            {includePaths.length > 0 && (
              <p className="mb-4">Only Include Paths: {includePaths.join(', ')}</p>
            )}
            <div className="mb-4 flex space-x-2">
              <button
                onClick={handleStart}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400"
                disabled={isStarted}
              >
                {isStarted ? 'Next feature/fix' : 'Start'}
              </button>
              {hasBackup && (
                <button
                  onClick={handleRestore}
                  className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:bg-gray-400"
                  disabled={!isStarted}
                >
                  Undo All & Restore Backup
                </button>
              )}
            </div>
            <div className="flex flex-grow">
              <div className="flex-grow mr-4">
                <div className="bg-white p-4 rounded shadow h-full">
                  {projectDir && (
                    <ChatInterface
                      projectDir={projectDir}
                      isStarted={isStarted}
                      hasBackup={hasBackup}
                      onStart={handleStart}
                      onRestore={handleRestore}
                      systemMessages={systemMessages}
                    />
                  )}
                </div>
              </div>
              <div className="w-1/3 space-y-4">
                {projectDir && (
                  <FileList
                    key={fileListKey}
                    projectDir={projectDir}
                    onSettingsUpdate={handleSettingsUpdate}
                    isChatStarted={isStarted}
                    onAnalyzeProject={analyzeProject}
                  />
                )}
                <APIKeyManager />
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
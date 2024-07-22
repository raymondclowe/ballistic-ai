'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { parseCommand } from '@/utils/commandParser';

interface ExecutionResult {
  id: string;
  output: string;
}

interface FormattedMessageProps {
  content: string;
  onDiff: (command: string) => void;
}

const FormattedMessage: React.FC<FormattedMessageProps> = ({ content, onDiff }) => {
  const [executionResults, setExecutionResults] = useState<ExecutionResult[]>([]);
  const [codeBlockIds, setCodeBlockIds] = useState<Record<number, string>>({});
  const [originalFileContents, setOriginalFileContents] = useState<Record<string, string>>({});

  const generateId = () => `code-${Math.random().toString(36).substr(2, 9)}`;

  const fetchFileContent = async (filePath: string): Promise<string> => {
    const response = await fetch('/api/read-file', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ filePath }),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch file content');
    }

    const data = await response.json();
    return data.content;
  };

  const handleExecute = async (code: string, id: string) => {
    try {
      const { filePath, newContent } = parseCommand(code);

      if (filePath) {
        const originalContent = await fetchFileContent(filePath);
        setOriginalFileContents(prevContents => ({
          ...prevContents,
          [filePath]: originalContent,
        }));
      }

      const response = await fetch('/api/execute-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const result = await response.json();
      const linesCount = code.split('\n').length;

      setExecutionResults((prevResults) => {
        const newResult = { id, output: `Executed ${linesCount} lines of code.\n\n${result.output}` };
        return [...prevResults.filter((res) => res.id !== id), newResult];
      });
    } catch (error) {
      setExecutionResults((prevResults) => {
        const newResult = { id, output: 'Error executing code, please check the console for more details.' };
        return [...prevResults.filter((res) => res.id !== id), newResult];
      });
    }
  };

  const handleRestore = async (filePath: string, originalContent: string) => {
    try {
      const response = await fetch('/api/restore-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath, content: originalContent }),
      });

      if (!response.ok) {
        throw new Error('Failed to restore original content');
      }

      alert('File restored successfully');
      delete originalFileContents[filePath];
    } catch (error) {
      alert('Failed to restore file content');
    }
  };

  const handleDiffClick = (code: string) => {
    onDiff(code);
  };

  return (
    <>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, inline, className, children, ...props }) {
            if (inline) {
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            } else {
              const nodeIndex = node.position?.start.line ?? Math.random();
              let id = codeBlockIds[nodeIndex];
              if (!id) {
                id = generateId();
                setCodeBlockIds((prevIds) => ({
                  ...prevIds,
                  [nodeIndex]: id,
                }));
              }

              const match = /language-(\w+)/.exec(className || '');
              const { filePath } = parseCommand(String(children));

              return (
                <div>
                  <SyntaxHighlighter
                    style={tomorrow as any}
                    language={match ? match[1] : ''}
                    PreTag="div"
                    {...props}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                  <div className="mt-2 space-x-2">
                    <button
                      onClick={() => handleExecute(String(children), id)}
                      className="px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                    >
                      Execute
                    </button>
                    <button
                      onClick={() => handleDiffClick(String(children))}
                      className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      Diff
                    </button>
                    {filePath && originalFileContents[filePath] && (
                      <button
                        onClick={() => handleRestore(filePath, originalFileContents[filePath])}
                        className="px-2 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                      >
                        Restore
                      </button>
                    )}
                  </div>
                  <div className="mt-2 bg-gray-100 p-2 rounded">
                    {executionResults.find((res) => res.id === id)?.output}
                  </div>
                </div>
              );
            }
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </>
  );
};

export default FormattedMessage;
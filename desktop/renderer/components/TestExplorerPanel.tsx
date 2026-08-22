"use client";

import React, { useState } from "react";
import {
  Play,
  RotateCcw,
  ChevronsUp,
  ChevronsDown,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  FileCode,
  Folder,
  Layers,
  ShieldCheck,
  Terminal,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  Sparkles,
  ArrowRight,
  FlaskConical,
  Bug,
} from "lucide-react";
import {
  useTests,
  TestFile,
  TestSuite,
  TestCase,
  TestOutputLog,
  CoverageReport,
} from "../hooks/useTests";
import CoveragePanel from "./CoveragePanel";

interface TestExplorerPanelProps {
  workspacePath: string;
  onOpenTestFile: (filePath: string, line?: number) => void;
  onRepairWithAI?: (repairContext: {
    testName: string;
    filePath: string;
    line?: number;
    errorSummary: string;
    stackTrace: string;
    command: string;
  }) => void;
  onDebugTest?: (test: TestCase) => void;
  testsHook: ReturnType<typeof useTests>;
}

export default function TestExplorerPanel({
  workspacePath,
  onOpenTestFile,
  onRepairWithAI,
  onDebugTest,
  testsHook,
}: TestExplorerPanelProps) {
  const {
    testFiles,
    totalTests,
    discovering,
    running,
    activeOutput,
    coverageData,
    coverageLoading,
    discoverTests,
    runSingleTest,
    runFileTests,
    runAllTests,
    fetchCoverage,
  } = testsHook;

  const [activeTab, setActiveTab] = useState<"tests" | "coverage">("tests");
  const [collapsedItems, setCollapsedItems] = useState<Record<string, boolean>>({});

  const toggleCollapse = (id: string) => {
    setCollapsedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCollapseAll = () => {
    const nextCollapsed: Record<string, boolean> = {};
    testFiles.forEach((file) => {
      nextCollapsed[file.filePath] = true;
      file.children.forEach((child) => {
        if (child.type === "suite") nextCollapsed[child.id] = true;
      });
    });
    setCollapsedItems(nextCollapsed);
  };

  const handleExpandAll = () => {
    setCollapsedItems({});
  };

  const renderStatusIcon = (status: string) => {
    switch (status) {
      case "passed":
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      case "failed":
        return <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
      case "running":
        return <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin shrink-0" />;
      case "skipped":
        return <Clock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />;
      default:
        return <div className="w-2.5 h-2.5 rounded-full border border-zinc-500 shrink-0" />;
    }
  };

  return (
    <div className="h-full flex flex-col font-mono text-xs select-none bg-[#070709] border-r border-[#1f1f24] overflow-hidden">
      {/* Top Header & Tab Switcher */}
      <div className="h-10 bg-[#0d0d12] border-b border-[#1f1f24] px-2.5 flex items-center justify-between shrink-0">
        {/* Left Tabs */}
        <div className="flex items-center gap-1 bg-[#141418] p-0.5 rounded-lg border border-[#27272a]">
          <button
            onClick={() => setActiveTab("tests")}
            className={`px-2 py-1 rounded text-[10.5px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "tests"
                ? "bg-cyan-950 text-cyan-300 border border-cyan-500/40"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <FlaskConical className="w-3 h-3 text-cyan-400" />
            <span>Tests ({totalTests})</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("coverage");
              if (!coverageData) fetchCoverage();
            }}
            className={`px-2 py-1 rounded text-[10.5px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "coverage"
                ? "bg-emerald-950 text-emerald-300 border border-emerald-500/40"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            <span>Coverage {coverageData ? `(${coverageData.overallCoveragePct}%)` : ""}</span>
          </button>
        </div>

        {/* Right Action Buttons */}
        {activeTab === "tests" && (
          <div className="flex items-center gap-1">
            <button
              onClick={runAllTests}
              disabled={running || testFiles.length === 0}
              className="p-1.5 rounded hover:bg-emerald-950 text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 transition-all cursor-pointer disabled:opacity-30"
              title="Run All Tests"
            >
              <Play className="w-3.5 h-3.5 fill-emerald-400" />
            </button>

            <button
              onClick={discoverTests}
              disabled={discovering}
              className="p-1.5 rounded hover:bg-[#1f1f26] text-zinc-400 hover:text-white transition-all cursor-pointer disabled:opacity-30"
              title="Refresh / Re-discover Tests"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${discovering ? "animate-spin text-cyan-400" : ""}`} />
            </button>

            <button
              onClick={handleCollapseAll}
              className="p-1.5 rounded hover:bg-[#1f1f26] text-zinc-400 hover:text-white transition-all cursor-pointer"
              title="Collapse All"
            >
              <ChevronsUp className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Main Content Pane */}
      {activeTab === "coverage" ? (
        <CoveragePanel
          coverage={coverageData}
          loading={coverageLoading}
          onRefresh={fetchCoverage}
          onSelectFile={onOpenTestFile}
        />
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Test Tree View */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {testFiles.map((file) => {
              const isFileCollapsed = collapsedItems[file.filePath] ?? false;

              return (
                <div
                  key={file.filePath}
                  className="rounded-xl bg-[#09090c] border border-[#1a1a22] overflow-hidden"
                >
                  {/* File Row */}
                  <div
                    onClick={() => toggleCollapse(file.filePath)}
                    className="p-2 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] text-[11px] group"
                  >
                    <div className="flex items-center gap-1.5 truncate pr-1">
                      {isFileCollapsed ? (
                        <ChevronRight className="w-3 h-3 text-zinc-500 shrink-0" />
                      ) : (
                        <ChevronDown className="w-3 h-3 text-zinc-500 shrink-0" />
                      )}
                      <FileCode className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span className="text-zinc-200 font-bold truncate">{file.name}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="px-1.5 py-0.5 rounded bg-[#14141c] text-zinc-400 text-[9.5px]">
                        {file.testCount}
                      </span>
                      {renderStatusIcon(file.status)}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          runFileTests(file.filePath, file.framework);
                        }}
                        disabled={running}
                        className="p-1 rounded hover:bg-[#1f1f26] text-zinc-400 hover:text-emerald-400 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                        title="Run this file"
                      >
                        <Play className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Children (Suites / Tests) */}
                  {!isFileCollapsed && (
                    <div className="pl-4 pr-1 pb-1 space-y-0.5 border-t border-[#14141a]">
                      {file.children.map((child) => {
                        if (child.type === "suite") {
                          const isSuiteCollapsed = collapsedItems[child.id] ?? false;
                          return (
                            <div key={child.id} className="space-y-0.5">
                              {/* Suite Row */}
                              <div
                                onClick={() => toggleCollapse(child.id)}
                                className="p-1 rounded hover:bg-[#121218] flex items-center justify-between cursor-pointer text-[10.5px] text-zinc-300"
                              >
                                <div className="flex items-center gap-1 truncate">
                                  {isSuiteCollapsed ? (
                                    <ChevronRight className="w-3 h-3 text-zinc-500" />
                                  ) : (
                                    <ChevronDown className="w-3 h-3 text-zinc-500" />
                                  )}
                                  <Layers className="w-3 h-3 text-purple-400" />
                                  <span className="font-semibold truncate">{child.name}</span>
                                </div>
                                <span className="text-[9.5px] text-zinc-500">
                                  {child.children.length}
                                </span>
                              </div>

                              {/* Suite Tests */}
                              {!isSuiteCollapsed && (
                                <div className="pl-4 space-y-0.5">
                                  {child.children.map((test) => (
                                    <div
                                      key={test.id}
                                      onClick={() => onOpenTestFile(test.filePath, test.line)}
                                      className="p-1 rounded hover:bg-[#15151e] flex items-center justify-between cursor-pointer group text-[10.5px]"
                                    >
                                      <div className="flex items-center gap-1.5 truncate pr-1">
                                        {renderStatusIcon(test.status)}
                                        <span className="text-zinc-300 group-hover:text-cyan-300 truncate">
                                          {test.name}
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-1 shrink-0">
                                        {test.durationMs !== undefined && (
                                          <span className="text-[9px] text-zinc-500 font-mono">
                                            {test.durationMs}ms
                                          </span>
                                        )}
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            runSingleTest(test);
                                          }}
                                          disabled={running}
                                          className="p-1 rounded hover:bg-[#20202c] text-zinc-400 hover:text-emerald-400 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                                          title="Run this test"
                                        >
                                          <Play className="w-2.5 h-2.5" />
                                        </button>
                                        {onDebugTest && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onDebugTest(test);
                                            }}
                                            className="p-1 rounded hover:bg-[#20202c] text-zinc-400 hover:text-cyan-400 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                                            title="Debug this test"
                                          >
                                            <Bug className="w-2.5 h-2.5" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        }

                        // Standalone Test
                        return (
                          <div
                            key={child.id}
                            onClick={() => onOpenTestFile(child.filePath, child.line)}
                            className="p-1 rounded hover:bg-[#15151e] flex items-center justify-between cursor-pointer group text-[10.5px]"
                          >
                            <div className="flex items-center gap-1.5 truncate pr-1">
                              {renderStatusIcon(child.status)}
                              <span className="text-zinc-300 group-hover:text-cyan-300 truncate">
                                {child.name}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {child.durationMs !== undefined && (
                                <span className="text-[9px] text-zinc-500 font-mono">
                                  {child.durationMs}ms
                                </span>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  runSingleTest(child);
                                }}
                                disabled={running}
                                className="p-1 rounded hover:bg-[#20202c] text-zinc-400 hover:text-emerald-400 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                                title="Run this test"
                              >
                                <Play className="w-2.5 h-2.5" />
                              </button>
                              {onDebugTest && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDebugTest(child as TestCase);
                                  }}
                                  className="p-1 rounded hover:bg-[#20202c] text-zinc-400 hover:text-cyan-400 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                                  title="Debug this test"
                                >
                                  <Bug className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {testFiles.length === 0 && !discovering && (
              <div className="py-12 text-center text-zinc-600 space-y-2">
                <FlaskConical className="w-8 h-8 text-zinc-700 mx-auto" />
                <p className="text-xs">No tests discovered in workspace.</p>
                <button
                  onClick={discoverTests}
                  className="px-2.5 py-1 rounded-lg bg-[#14141c] hover:bg-[#1e1e28] text-cyan-400 text-[10.5px] font-bold border border-cyan-500/30"
                >
                  Scan for Tests
                </button>
              </div>
            )}
          </div>

          {/* Docked Output Stream Panel */}
          {activeOutput && (
            <div className="h-44 border-t border-[#1f1f26] bg-[#050508] flex flex-col shrink-0 font-mono text-[10.5px]">
              {/* Output Header */}
              <div className="h-7 bg-[#0b0b10] border-b border-[#1a1a22] px-2 flex items-center justify-between text-zinc-400">
                <div className="flex items-center gap-1.5">
                  <Terminal className="w-3 h-3 text-cyan-400" />
                  <span className="font-bold text-zinc-300 truncate max-w-[200px]">
                    {activeOutput.command}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold uppercase ${
                      activeOutput.status === "passed"
                        ? "bg-emerald-950 text-emerald-300 border border-emerald-500/40"
                        : activeOutput.status === "failed"
                        ? "bg-rose-950 text-rose-300 border border-rose-500/40"
                        : "bg-cyan-950 text-cyan-300"
                    }`}
                  >
                    {activeOutput.status}
                  </span>
                  {activeOutput.durationMs > 0 && (
                    <span className="text-zinc-500 text-[9.5px]">
                      {activeOutput.durationMs}ms
                    </span>
                  )}
                </div>
              </div>

              {/* Output Log Body */}
              <div className="flex-1 p-2 overflow-y-auto whitespace-pre-wrap leading-tight text-zinc-300 space-y-1">
                {activeOutput.stdout && <div>{activeOutput.stdout}</div>}
                {activeOutput.stderr && <div className="text-rose-400">{activeOutput.stderr}</div>}

                {/* Failure Action Buttons */}
                {activeOutput.status === "failed" && (
                  <div className="pt-2 flex items-center gap-2 flex-wrap">
                    {onRepairWithAI && (
                      <button
                        onClick={() => {
                          const errText = activeOutput.stderr || activeOutput.stdout || "Test failed";
                          onRepairWithAI({
                            testName: activeOutput.command,
                            filePath: activeOutput.command.split(" ")[1] || "",
                            line: activeOutput.failureLine,
                            errorSummary: errText.slice(0, 300),
                            stackTrace: errText,
                            command: activeOutput.command,
                          });
                        }}
                        className="px-2.5 py-1 rounded bg-purple-950/90 hover:bg-purple-900 border border-purple-500/50 text-purple-200 text-[10.5px] font-bold flex items-center gap-1.5 cursor-pointer shadow-[0_0_8px_rgba(168,85,247,0.3)] transition-all"
                        title="Dispatch autonomous repair for this failure"
                      >
                        <Sparkles className="w-3 h-3 text-purple-400" />
                        <span>Repair with AI</span>
                      </button>
                    )}

                    {onDebugTest && (
                      <button
                        onClick={() => {
                          const testTarget = activeOutput.command.split(" ")[1] || "";
                          onDebugTest({
                            id: `test_fail_${Date.now()}`,
                            name: activeOutput.command,
                            filePath: testTarget,
                            line: activeOutput.failureLine || 1,
                            type: "test",
                            framework: testTarget.endsWith(".py") ? "pytest" : "jest",
                            status: "failed",
                          });
                        }}
                        className="px-2.5 py-1 rounded bg-cyan-950/90 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-200 text-[10.5px] font-bold flex items-center gap-1.5 cursor-pointer shadow-[0_0_8px_rgba(6,182,212,0.3)] transition-all"
                        title="Start debug session on this failing test"
                      >
                        <Bug className="w-3 h-3 text-cyan-400" />
                        <span>Debug Test</span>
                      </button>
                    )}

                    {activeOutput.failureLine && (
                      <button
                        onClick={() =>
                          onOpenTestFile(
                            activeOutput.command.split(" ")[1] || "",
                            activeOutput.failureLine
                          )
                        }
                        className="px-2 py-1 rounded bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 text-rose-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <ArrowRight className="w-3 h-3" />
                        <span>Jump to Failure (Line {activeOutput.failureLine})</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/common/Navbar';
import { DashboardView } from './components/dashboard/DashboardView';
import { WorkspaceView } from './components/workspace/WorkspaceView';
import { CreateProjectModal } from './components/dashboard/CreateProjectModal';
import { ImportProjectModal } from './components/dashboard/ImportProjectModal';
import { ToastProvider, useToast } from './components/common/Toast';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Project } from './types';
import { api } from './api/client';

function AppContent() {
  const { currentUser } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(() => {
    // Check URL query param or state
    const params = new URLSearchParams(window.location.search);
    return params.get('project');
  });

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);

  const { success, error } = useToast();

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getProjects();
      setProjects(data);
    } catch (err: any) {
      error(err.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects, currentUser]);

  const handleOpenProject = (id: string) => {
    setActiveProjectId(id);
    const url = new URL(window.location.href);
    url.searchParams.set('project', id);
    window.history.pushState({}, '', url.toString());
  };

  const handleNavigateHome = () => {
    setActiveProjectId(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('project');
    window.history.pushState({}, '', url.toString());
    loadProjects();
  };

  const activeProject = projects.find(p => p.id === activeProjectId);

  const handleCreateProject = async (data: {
    name: string;
    description?: string;
    prefix?: string;
    color?: string;
    purpose?: 'sprite' | 'font';
    visibility?: 'public' | 'private';
    publicAccess?: 'view' | 'edit';
  }) => {
    try {
      const created = await api.createProject(data);
      success('Project created successfully!');
      await loadProjects();
      handleOpenProject(created.id);
    } catch (err: any) {
      error(err.message || 'Failed to create project');
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-background text-foreground flex flex-col font-sans">
      <Navbar
        currentProjectName={activeProject?.name}
        onNavigateHome={handleNavigateHome}
        onCreateProject={!activeProjectId ? () => setCreateModalOpen(true) : undefined}
        onImportProject={!activeProjectId ? () => setImportModalOpen(true) : undefined}
      />

      <main className="flex-1 w-full min-h-0 flex flex-col overflow-hidden">
        <ErrorBoundary name="MainView">
          {activeProjectId ? (
            <WorkspaceView
              projectId={activeProjectId}
              onBackToDashboard={handleNavigateHome}
            />
          ) : (
            <DashboardView
              projects={projects}
              loading={loading}
              onRefresh={loadProjects}
              onOpenProject={handleOpenProject}
            />
          )}
        </ErrorBoundary>
      </main>

      {/* Global Modals for Navbar triggers */}
      <CreateProjectModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSubmit={handleCreateProject}
      />

      <ImportProjectModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onSuccess={loadProjects}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary name="RootApp">
      <AuthProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

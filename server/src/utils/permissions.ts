import { UserRecord, UserSafe } from '../db/repositories/userRepo.js';
import { ProjectRecord } from '../db/repositories/projectRepo.js';

export type UserOrSafe = UserRecord | UserSafe | null | undefined;

export const Permissions = {
  /**
   * Can the user view this project, its folders, and its icons?
   * - Admin: ALWAYS YES
   * - Owner / Creator: ALWAYS YES
   * - Public project: YES
   * - Private project of other user: NO
   */
  canView(user: UserOrSafe, project: ProjectRecord): boolean {
    if (!project) return false;
    if (user?.role === 'admin') return true;
    if (user && project.owner_id === user.id) return true;
    if (project.visibility === 'public') return true;
    return false;
  },

  /**
   * Can the user add icons to this project?
   * (upload SVGs, paste SVG, import sprite, import font, copy icons from public project)
   * - Admin: YES
   * - Owner / Creator: YES
   * - Public project: YES ("public project user any one view or add icons to the public project")
   * - Private project of other user: NO
   */
  canAddIcons(user: UserOrSafe, project: ProjectRecord): boolean {
    if (!project) return false;
    if (user?.role === 'admin') return true;
    if (user && project.owner_id === user.id) return true;
    if (project.visibility === 'public') return true;
    return false;
  },

  /**
   * Can the user edit the project? (modify/rename/delete existing icons, modify folders, settings)
   * - Admin: ALWAYS YES
   * - Owner / Creator: ALWAYS YES ("no one can edit the public project except creator")
   * - Others (even on public project): NO
   */
  canEdit(user: UserOrSafe, project: ProjectRecord): boolean {
    if (!project) return false;
    if (user?.role === 'admin') return true;
    if (user && project.owner_id === user.id) return true;
    return false;
  },

  /**
   * Can the user delete the project or change its core settings / visibility?
   * - Admin: ALWAYS YES
   * - Owner / Creator: ALWAYS YES
   * - Others: NO
   */
  canManage(user: UserOrSafe, project: ProjectRecord): boolean {
    if (!project) return false;
    if (user?.role === 'admin') return true;
    if (user && project.owner_id === user.id) return true;
    return false;
  },

  isAdmin(user: UserOrSafe): boolean {
    return user?.role === 'admin';
  },

  isOwner(user: UserOrSafe, project: ProjectRecord): boolean {
    if (!user || !project) return false;
    return project.owner_id === user.id;
  }
};

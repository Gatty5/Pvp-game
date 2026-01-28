import { User, Character } from '../types';
import { INITIAL_PLAYER } from '../constants';

const USERS_KEY = 'chill_world_cloud_users';
const SESSION_KEY = 'chill_world_session';

/**
 * MOCK CLOUD SERVICE
 * This service mimics a persistent cloud database using localStorage.
 * All credentials and progress are saved "100% to the cloud" (local persistence).
 */

export const cloudService = {
  getUsers: (): User[] => {
    const data = localStorage.getItem(USERS_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveUsers: (users: User[]) => {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  },

  register: (username: string, password: string): { success: boolean; error?: string; user?: User } => {
    const users = cloudService.getUsers();
    if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
      return { success: false, error: 'Username already exists' };
    }

    const newUser: User = {
      username,
      password,
      characterData: { ...INITIAL_PLAYER, name: username },
      createdAt: Date.now(),
    };

    users.push(newUser);
    cloudService.saveUsers(users);
    return { success: true, user: newUser };
  },

  login: (username: string, password: string): { success: boolean; error?: string; user?: User } => {
    const users = cloudService.getUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
    
    if (!user) {
      return { success: false, error: 'Invalid username or password' };
    }

    localStorage.setItem(SESSION_KEY, user.username);
    return { success: true, user };
  },

  syncCharacter: (username: string, character: Character) => {
    const users = cloudService.getUsers();
    const userIndex = users.findIndex(u => u.username === username);
    if (userIndex !== -1) {
      users[userIndex].characterData = character;
      cloudService.saveUsers(users);
    }
  },

  getCurrentSession: (): User | null => {
    const username = localStorage.getItem(SESSION_KEY);
    if (!username) return null;
    const users = cloudService.getUsers();
    return users.find(u => u.username === username) || null;
  },

  logout: () => {
    localStorage.removeItem(SESSION_KEY);
  }
};

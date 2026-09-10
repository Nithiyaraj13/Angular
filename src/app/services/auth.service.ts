import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { User } from '../../Models/User';
import { StorageService } from './storage.service';

const USERS_KEY = 'app_users';
const SESSION_KEY = 'app_session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private storage = inject(StorageService);
  private router = inject(Router);
  private currentUserSubject = new BehaviorSubject<User | null>(null);

  currentUser$ = this.currentUserSubject.asObservable();

  constructor() {
    this.seedAdminUser();
    const savedUser = this.storage.getJSON<User>(SESSION_KEY);
    if (savedUser) this.currentUserSubject.next(savedUser);
  }

  private seedAdminUser(): void {
    const users = this.getUsers();
    if (!users.find(u => u.username === 'admin')) {
      const admin: User = {
        id: crypto.randomUUID(),
        username: 'admin',
        email: 'admin@example.com',
        password: 'admin123',
        role: 'admin',
        createdAt: new Date().toISOString()
      };
      this.saveUsers([...users, admin]);
    }
  }

  getUsers(): User[] {
    return this.storage.getJSON<User[]>(USERS_KEY) ?? [];
  }

  private saveUsers(users: User[]): void {
    this.storage.setJSON(USERS_KEY, users);
  }

  login(username: string, password: string): { success: boolean; message: string } {
    const users = this.getUsers();
    const user = users.find(u => u.username === username && u.password === password);
    if (!user) return { success: false, message: 'Invalid username or password.' };
    this.currentUserSubject.next(user);
    this.storage.setJSON(SESSION_KEY, user);
    return { success: true, message: 'Login successful.' };
  }

  register(username: string, email: string, password: string): { success: boolean; message: string } {
    const users = this.getUsers();
    if (users.find(u => u.username === username)) {
      return { success: false, message: 'Username already taken.' };
    }
    if (users.find(u => u.email === email)) {
      return { success: false, message: 'Email already registered.' };
    }
    const newUser: User = {
      id: crypto.randomUUID(),
      username,
      email,
      password,
      role: 'user',
      createdAt: new Date().toISOString()
    };
    this.saveUsers([...users, newUser]);
    return { success: true, message: 'Registration successful. Please log in.' };
  }

  logout(): void {
    this.currentUserSubject.next(null);
    this.storage.remove(SESSION_KEY);
    this.router.navigate(['/login']);
  }

  isLoggedIn(): boolean {
    return this.currentUserSubject.value !== null;
  }

  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }
}

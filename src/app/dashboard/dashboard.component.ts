import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { interval, Subscription } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { User } from '../../Models/User';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private clockSub?: Subscription;

  currentUser: User | null = null;
  currentTime = new Date();
  totalUsers = 0;
  activityLog: { time: string; message: string; type: 'info' | 'success' | 'warning' }[] = [];

  ngOnInit(): void {
    this.currentUser = this.auth.currentUser;
    this.totalUsers = this.auth.getUsers().length;
    this.clockSub = interval(1000).subscribe(() => {
      this.currentTime = new Date();
    });
    this.addActivity('success', `${this.currentUser?.username} logged in successfully`);
    this.addActivity('info', 'Dashboard initialized');
    this.addActivity('info', `Session started at ${new Date().toLocaleTimeString()}`);
  }

  ngOnDestroy(): void {
    this.clockSub?.unsubscribe();
  }

  private addActivity(type: 'info' | 'success' | 'warning', message: string): void {
    this.activityLog.unshift({ time: new Date().toLocaleTimeString(), message, type });
    if (this.activityLog.length > 10) this.activityLog.pop();
  }

  logout(): void {
    this.auth.logout();
  }
}

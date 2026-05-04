import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DbService } from '../core/services/db.service';
import { BehaviorSubject, Observable } from 'rxjs';

@Component({
  selector: 'app-superadmin',
  standalone: true,
  imports: [CommonModule],
  providers: [DbService],
  templateUrl: './superadmin.component.html',
  styleUrls: ['./superadmin.component.scss']
})
export class SuperadminComponent implements OnInit {
  private _data = new BehaviorSubject<any>(null);
  public data$ = this._data.asObservable();
  public state$: Observable<any>;

  constructor(private db: DbService) {
    this.state$ = this.db.state$;
  }

  async ngOnInit(): Promise<void> {
    try {
      const session = await this.db.requireAuth({ role: 'superadmin' });
      this.db.setContext({ organizationId: null, role: 'superadmin' });

      const resources = ['organizations', 'admins', 'settings']; 
      await this.db.ensureResources(resources);

      const organizations = await this.db.getStableResource('organizations');
      const admins = await this.db.getStableResource('admins');
      
      this._data.next({ organizations, admins });
    } catch (err) {
      console.error('Erreur côté Super Admin', err);
    }
  }
}

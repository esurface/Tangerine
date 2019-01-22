import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CaseComponent } from './components/case/case.component';
import { EventComponent } from './components/event/event.component';
//import { FormComponent } from './components/form/form.component';
import { CasesComponent } from './components/cases/cases.component';
import { NewCaseComponent } from './components/new-case/new-case.component';
import { CaseRoutingModule } from './case-routing.module';
import { EventFormComponent } from './components/event-form/event-form.component';
import { CaseBreadcrumbComponent } from './components/case-breadcrumb/case-breadcrumb.component';

@NgModule({
  schemas: [ CUSTOM_ELEMENTS_SCHEMA ],
  imports: [
    CaseRoutingModule,
    CommonModule
  ],
  declarations: [
    EventComponent,
    CasesComponent,
    CaseComponent,
    NewCaseComponent,
    EventFormComponent,
    CaseBreadcrumbComponent
  ]
})
export class CaseModule { }

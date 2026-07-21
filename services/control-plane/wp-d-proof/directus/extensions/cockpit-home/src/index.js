import ModuleComponent from './module.vue';

export default {
  id: 'cockpit',
  name: 'Cockpit',
  icon: 'space_dashboard',
  routes: [
    { path: '', component: ModuleComponent },
  ],
};

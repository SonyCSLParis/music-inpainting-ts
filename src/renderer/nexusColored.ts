// Simple module to store and share the color parameters for Nexus UI

import * as Nexus from 'nexusui';
import colors from '../common/styles/mixins/_colors.module.scss';

Nexus.colors.accent = colors.active_control;
Nexus.colors.fill = colors.idle_control;

export { Nexus };
export default Nexus;

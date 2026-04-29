import { Outlet, createFileRoute } from '@tanstack/react-router';
import type { AnyRoute } from '@tanstack/react-router';

export const Route: AnyRoute = createFileRoute('/agents')({
  component: AgentsLayout,
});

function AgentsLayout() {
  return <Outlet />;
}

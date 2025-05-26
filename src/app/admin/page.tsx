
import { AdminDashboard } from '@/components/features/admin/AdminDashboard';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <CardHeader className="px-0 pb-2">
        <CardTitle className="text-3xl font-bold text-primary">Admin Panel</CardTitle>
        <CardDescription>
          Manage lottery results and application data.
        </CardDescription>
      </CardHeader>
      <AdminDashboard />
    </div>
  );
}

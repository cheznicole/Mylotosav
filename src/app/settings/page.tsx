
import { SettingsDashboard } from '@/components/features/settings/SettingsDashboard';
import { CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <CardHeader className="px-0 pb-2">
        <CardTitle className="text-3xl font-bold text-primary">Settings</CardTitle>
        <CardDescription>
          Manage application settings and data.
        </CardDescription>
      </CardHeader>
      <SettingsDashboard />
    </div>
  );
}

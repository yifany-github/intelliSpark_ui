import { Clock, Database, Download, RefreshCw, Upload } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const SystemTab = () => (
  <>
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-2">System Management</h2>
      <p className="text-slate-600">System tools and utilities</p>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center text-slate-900">
            <Upload className="w-5 h-5 mr-2 text-blue-600" />
            Data Import/Export
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button variant="outline" className="w-full justify-start text-slate-700 border-slate-300 bg-white hover:bg-slate-50">
              <Upload className="w-4 h-4 mr-2" />
              Import Characters from JSON
            </Button>
            <Separator />
            <Button variant="outline" className="w-full justify-start text-slate-700 border-slate-300 bg-white hover:bg-slate-50">
              <Download className="w-4 h-4 mr-2" />
              Export All Data
            </Button>
            <Button variant="outline" className="w-full justify-start text-slate-700 border-slate-300 bg-white hover:bg-slate-50">
              <Download className="w-4 h-4 mr-2" />
              Export Analytics Report
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center text-slate-900">
            <Database className="w-5 h-5 mr-2 text-green-600" />
            Database Tools
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button variant="outline" className="w-full justify-start text-slate-700 border-slate-300 bg-white hover:bg-slate-50">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh All Data
            </Button>
            <Button variant="outline" className="w-full justify-start text-slate-700 border-slate-300 bg-white hover:bg-slate-50">
              <Database className="w-4 h-4 mr-2" />
              Database Statistics
            </Button>
            <Separator />
            <Alert className="border-yellow-200 bg-yellow-50">
              <Clock className="w-4 h-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                Last backup: Never (Configure automatic backups)
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>
    </div>
  </>
);

export default SystemTab;

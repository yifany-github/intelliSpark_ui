import { Activity, MessageSquare, Target, Users, Zap } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdminStats } from "../types";

const OverviewTab = ({ stats }: { stats?: AdminStats }) => (
  <>
    {/* Stats Cards */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-blue-100">Total Users</CardTitle>
          <Users className="w-5 h-5 text-blue-200" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{stats?.totals.users || 0}</div>
          <p className="text-xs text-blue-200 mt-1">Active community members</p>
        </CardContent>
      </Card>


      <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0 shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-green-100">Characters</CardTitle>
          <Target className="w-5 h-5 text-green-200" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{stats?.totals.characters || 0}</div>
          <p className="text-xs text-green-200 mt-1">AI personalities</p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-0 shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-orange-100">Total Chats</CardTitle>
          <MessageSquare className="w-5 h-5 text-orange-200" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{stats?.totals.chats || 0}</div>
          <p className="text-xs text-orange-200 mt-1">Conversations started</p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-pink-500 to-pink-600 text-white border-0 shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-pink-100">Messages</CardTitle>
          <Zap className="w-5 h-5 text-pink-200" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{stats?.totals.messages || 0}</div>
          <p className="text-xs text-pink-200 mt-1">Total exchanges</p>
        </CardContent>
      </Card>
    </div>

    {/* Popular Content */}
    <div className="grid grid-cols-1 gap-6">
      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center text-slate-900">
            <Users className="w-5 h-5 mr-2 text-blue-600" />
            Popular Characters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats?.popular_content.characters.map((character, index) => (
              <div key={index} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                    <span className="text-sm font-bold text-blue-600">#{index + 1}</span>
                  </div>
                  <span className="font-medium text-slate-700">{character.name}</span>
                </div>
                <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
                  {character.chat_count} chats
                </Badge>
              </div>
            ))}
            {(!stats?.popular_content.characters.length) && (
              <p className="text-gray-500 text-center py-4">No data available yet</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>

    {/* Recent Activity Alert */}
    <Alert className="border-blue-200 bg-blue-50">
      <Activity className="w-4 h-4 text-blue-600" />
      <AlertDescription className="text-blue-800">
        <strong>{stats?.recent_activity.chats_last_30_days || 0}</strong> new chats created in the last 30 days
      </AlertDescription>
    </Alert>
  </>
);

export default OverviewTab;

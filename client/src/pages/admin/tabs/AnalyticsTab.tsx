import { Activity, Target, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdminStats, Character } from "../types";

const AnalyticsTab = ({
  characters,
  stats,
}: {
  characters: Character[];
  stats?: AdminStats;
}) => (
  <>
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-2">Analytics Dashboard</h2>
      <p className="text-slate-600">Advanced insights and metrics</p>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* 分类标签统计 */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center text-slate-900">
            <Target className="w-5 h-5 mr-2 text-purple-600" />
            分类标签分布
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(() => {
              // 计算分类标签分布
              const categoryCount: { [key: string]: number } = {};
              characters.forEach(character => {
                if (character.categories && character.categories.length > 0) {
                  character.categories.forEach(category => {
                    categoryCount[category] = (categoryCount[category] || 0) + 1;
                  });
                } else {
                  categoryCount['未分类'] = (categoryCount['未分类'] || 0) + 1;
                }
              });

              const sortedCategories = Object.entries(categoryCount)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 6);

              return sortedCategories.map(([category, count]) => (
                <div key={category} className="flex items-center justify-between p-2 bg-purple-50 rounded-lg">
                  <span className="text-sm font-medium text-purple-800">{category}</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-16 bg-purple-200 rounded-full h-2">
                      <div
                        className="bg-purple-600 h-2 rounded-full"
                        style={{ width: `${Math.max(count / Math.max(...Object.values(categoryCount)) * 100, 10)}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-purple-600">{count}</span>
                  </div>
                </div>
              ));
            })()}
          </div>
        </CardContent>
      </Card>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center text-slate-900">
            <TrendingUp className="w-5 h-5 mr-2 text-green-600" />
            Content Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">

            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-blue-800">Average Messages per Chat</span>
                <span className="text-lg font-bold text-blue-600">
                  {stats?.totals?.chats && stats.totals.chats > 0 ? Math.round((stats?.totals?.messages || 0) / stats.totals.chats) : 0}
                </span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: '60%' }}></div>
              </div>
            </div>

            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-purple-800">User Engagement Rate</span>
                <span className="text-lg font-bold text-purple-600">
                  {stats?.totals?.users && stats.totals.users > 0 ? Math.round(((stats?.totals?.chats || 0) / stats.totals.users) * 100) : 0}%
                </span>
              </div>
              <div className="w-full bg-purple-200 rounded-full h-2">
                <div className="bg-purple-600 h-2 rounded-full" style={{ width: '85%' }}></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center text-slate-900">
            <Activity className="w-5 h-5 mr-2 text-blue-600" />
            System Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                <span className="text-sm font-medium text-green-800">API Status</span>
              </div>
              <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">Online</Badge>
            </div>

            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full mr-3"></div>
                <span className="text-sm font-medium text-blue-800">Database</span>
              </div>
              <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">Connected</Badge>
            </div>

            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-yellow-500 rounded-full mr-3"></div>
                <span className="text-sm font-medium text-yellow-800">AI Service</span>
              </div>
              <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">Simulated</Badge>
            </div>

            <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-purple-500 rounded-full mr-3"></div>
                <span className="text-sm font-medium text-purple-800">Admin Panel</span>
              </div>
              <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300">Active</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </>
);

export default AnalyticsTab;

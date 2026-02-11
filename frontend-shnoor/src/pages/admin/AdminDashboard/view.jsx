import React from 'react';
import { Users, BookOpen, Clock, Award, TrendingUp, Search, MessageSquare, ArrowRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Link } from 'react-router-dom';
const AdminDashboardView = ({ stats, chartData, loading }) => {
  if (loading) return <div className="p-10 text-slate-400 animate-pulse font-medium">Syncing data...</div>;

  const StatCard = ({ label, value, icon: Icon, color }) => (
    <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm group hover:border-indigo-500 transition-all">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon size={22} />
        </div>
        <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
          <TrendingUp size={12} /> +4%
        </span>
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</p>
        <h3 className="text-3xl font-semibold text-primary-900 tracking-tight">{value}</h3>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700 font-sans">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-semibold text-primary-900 tracking-tight">Analytics Overview</h1>
          <p className="text-slate-500 mt-1 font-medium text-base">Real-time performance metrics across the platform.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-64 transition-all" placeholder="Search parameters..." />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard label="Active Students" value={stats?.totalStudents ?? 0} icon={Users} color="bg-indigo-50 text-indigo-600" />
        <StatCard label="Completion Rates" value={`${stats?.completionRate ?? 0}%`} icon={BookOpen} color="bg-emerald-50 text-emerald-600" />
        <StatCard label="Total Learning Hours" value={stats?.totalHours ?? 0} icon={Clock} color="bg-amber-50 text-amber-600" />
        <StatCard label="Certificates Issued" value={stats?.certificates ?? 0} icon={Award} color="bg-rose-50 text-rose-600" />
      </div>



      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-6 rounded-lg border border-slate-200 shadow-sm h-[450px] flex flex-col">
          <div className="flex justify-between items-center mb-10">
            <h3 className="text-base font-semibold text-primary-900 uppercase tracking-wide">Learning Activity</h3>
            <div className="flex gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500"><div className="w-2 h-2 rounded-full bg-indigo-600"></div> Lessons Completed</div>
            </div>
          </div>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }} dy={10} />
                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="lessons" fill="#0f172a" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-primary-900 p-8 rounded-lg text-white flex flex-col justify-between relative overflow-hidden shadow-lg">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
          <div>
            <h3 className="text-sm font-bold text-indigo-200 uppercase tracking-wide mb-6">System Health</h3>
            <div className="space-y-8">
              <div>
                <div className="flex justify-between text-xs font-semibold mb-2 text-indigo-100"><span>Cloud Storage</span><span>65%</span></div>
                <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden"><div className="bg-indigo-500 h-full w-[65%]"></div></div>
              </div>
              <div>
                <div className="flex justify-between text-xs font-semibold mb-2 text-indigo-100"><span>Server Uptime</span><span>99.9%</span></div>
                <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden"><div className="bg-emerald-500 h-full w-[99%]"></div></div>
              </div>
            </div>
          </div>
          <button className="w-full py-3 bg-white text-primary-900 hover:bg-slate-50 rounded-md text-sm font-bold transition-all shadow-md">View Full System Report</button>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardView;
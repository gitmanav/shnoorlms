import React from "react";
import { Outlet } from "react-router-dom";
import {
  List,
  Trophy,
  UserCircle,
  LogOut,
  Star,
  TrendingUp,
  ClipboardList,
  Code,
  Menu,
  Settings,
  MessageSquare,
  Award,
  HelpCircle,
  Users,
} from "lucide-react";
import markLogo from "../../../assets/just_logo.jpeg";

const StudentLayoutView = ({
  studentName,
  xp,
  rank,
  isSidebarOpen,
  setIsSidebarOpen,
  handleLogout,
  totalUnread,
  navigate,
  location,
  photoURL,
}) => {
  const NavItem = ({ path, icon: Icon, label, badgeCount }) => {
    const isActive =
      location.pathname.includes(path) &&
      (path !== "courses" || !location.pathname.includes("dashboard"));

    return (
      <li
        className={`flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all duration-200 mt-1
                    ${isActive
            ? "bg-primary-900 text-white shadow-md"
            : "text-slate-600 hover:bg-slate-100"
          }`}
        onClick={() => {
          navigate(`/student/${path}`);
          setIsSidebarOpen(false);
        }}
      >
        <div className="flex items-center gap-3 w-full">
          <Icon className={isActive ? "text-white" : "text-slate-500"} />
          <span className="font-medium flex-1">{label}</span>
          {badgeCount > 0 && (
            <span className="bg-primary-900 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-sm">
              {badgeCount}
            </span>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900">
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <div
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 shadow-xl lg:shadow-none transform transition-transform duration-300 ease-in-out
                ${isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
            `}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-3 p-6 border-b border-slate-100">
            <img
              src={markLogo}
              alt="SHNOOR International"
              className="w-10 h-10 rounded-full object-cover shadow-sm"
            />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-primary-900 tracking-tight">
                SHNOOR
              </span>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-widest">
                International
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-6 px-4 scrollbar-thin scrollbar-thumb-slate-200">
            <ul className="space-y-1">
              <NavItem path="dashboard" icon={TrendingUp} label="Dashboard" />
              <NavItem path="courses" icon={List} label="My Courses" />
              <NavItem path="exams" icon={ClipboardList} label="Exams" />
              <NavItem path="contests" icon={Trophy} label="Weekly Contests" />
              <NavItem path="certificates" icon={Award} label="Certificates" />
              <NavItem path="practice" icon={Code} label="Practice Arena" />
              <NavItem
                path="chat"
                icon={MessageSquare}
                label="Messages"
                badgeCount={totalUnread}
              />
              <NavItem 
                path="groups" 
                icon={Users} 
                label="My Groups" 
              />
              <NavItem
                path="messages"
                icon={HelpCircle}
                label="Admin Support"
              />
              <NavItem path="settings" icon={Settings} label="Settings" />
            </ul>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white border-b border-slate-200 h-16 px-4 lg:px-8 flex items-center justify-between shadow-sm sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
              <Menu className="text-xl" />
            </button>
            <h2 className="text-xl font-semibold text-primary-900 hidden sm:block">
              Student Portal
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-none mb-0.5">
                  Rank
                </span>
                <span className="text-primary-900 font-bold text-sm leading-none">
                  {rank}
                </span>
              </div>
              <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-primary-900">
                <Trophy size={14} />
              </div>
            </div>

            <div className="hidden md:flex items-center gap-2 bg-amber-50 text-amber-900 px-3 py-1.5 rounded-full border border-amber-200 font-bold text-sm">
              <Star className="text-amber-500" size={14} fill="currentColor" />{" "}
              {xp} XP
            </div>

            <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
              <div className="text-right hidden md:block">
                <div className="text-sm font-semibold text-primary-900">
                  {studentName}
                </div>
                <div className="text-xs text-slate-500 font-medium">
                  Student
                </div>
              </div>
              <div
                onClick={() => navigate("settings")}
                className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center 
                      text-slate-400 border border-slate-200 overflow-hidden 
                      cursor-pointer hover:ring-2 hover:ring-indigo-500 transition"
              >
                {photoURL ? (
                  <img
                    src={photoURL}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <UserCircle className="w-full h-full p-1" />
                )}
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-primary-900 hover:bg-slate-100 rounded-lg transition-all duration-200"
                title="Logout"
              >
                <LogOut className="text-lg" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-slate-50 p-4 lg:p-8">
          <div className="w-full h-full">
            <Outlet context={{ studentName, xp }} />
          </div>
        </main>
      </div>
    </div>
  );
};

export default StudentLayoutView;

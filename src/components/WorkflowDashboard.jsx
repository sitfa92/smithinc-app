import { useEffect, useState } from "react";
import { supabase } from "../supabase.js";

export default function WorkflowDashboard() {
  const [events, setEvents] = useState([]);
  const [leads, setLeads] = useState([]);
  const [clients, setClients] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("events");

  useEffect(() => {
    fetchAllData();

    // Set up real-time subscriptions
    const eventsChannel = supabase
      .channel("workflow_events")
      .on("postgres_changes", { event: "*", schema: "public", table: "workflow_events" }, () => {
        fetchAllData();
      })
      .subscribe();

    const leadsChannel = supabase
      .channel("leads")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => {
        fetchAllData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(eventsChannel);
      supabase.removeChannel(leadsChannel);
    };
  }, []);

  async function fetchAllData() {
    try {
      setLoading(true);

      // Fetch recent workflow events
      const { data: eventsData } = await supabase
        .from("workflow_events")
        .select("id, event_type, status, event_data, error_message, created_at")
        .order("created_at", { ascending: false })
        .limit(50);

      // Fetch leads
      const { data: leadsData } = await supabase
        .from("leads")
        .select("id, name, email, service_type, status, created_at")
        .order("created_at", { ascending: false })
        .limit(20);

      // Fetch clients
      const { data: clientsData } = await supabase
        .from("clients")
        .select("id, name, email, service_type, client_value, status, created_at")
        .order("created_at", { ascending: false })
        .limit(20);

      // Fetch enrollments
      const { data: enrollmentsData } = await supabase
        .from("program_enrollments")
        .select("id, student_name, program_name, program_tier, status, start_date, created_at")
        .order("created_at", { ascending: false })
        .limit(20);

      setEvents(eventsData || []);
      setLeads(leadsData || []);
      setClients(clientsData || []);
      setEnrollments(enrollmentsData || []);
    } catch (_err) {
      // silently handle fetch errors
    } finally {
      setLoading(false);
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const stats = {
    totalLeads: leads.length,
    totalClients: clients.length,
    totalEnrollments: enrollments.length,
    recentEvents: events.filter((e) => e.status === "success").length,
    failedEvents: events.filter((e) => e.status === "failed").length,
  };

  return (
    <div className="workflow-dashboard">
      <style>{`
        .workflow-dashboard {
          padding: 24px;
          background: #f9fafb;
          min-height: 100vh;
        }

        .dashboard-header {
          margin-bottom: 32px;
        }

        .dashboard-header h1 {
          font-size: 28px;
          font-weight: 700;
          color: #1f2937;
          margin-bottom: 8px;
        }

        .dashboard-header p {
          color: #6b7280;
          font-size: 14px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 32px;
        }

        .stat-card {
          background: white;
          padding: 20px;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
        }

        .stat-card h3 {
          font-size: 12px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          margin-bottom: 8px;
        }

        .stat-card .value {
          font-size: 32px;
          font-weight: 700;
          color: #1f2937;
        }

        .tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 24px;
          border-bottom: 1px solid #e5e7eb;
        }

        .tab-button {
          padding: 12px 16px;
          background: none;
          border: none;
          font-size: 14px;
          font-weight: 500;
          color: #6b7280;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: all 0.2s;
        }

        .tab-button.active {
          color: #3b82f6;
          border-bottom-color: #3b82f6;
        }

        .tab-button:hover {
          color: #1f2937;
        }

        .table-container {
          background: white;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          overflow: hidden;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }

        thead {
          background: #f3f4f6;
          border-bottom: 1px solid #e5e7eb;
        }

        th {
          padding: 12px 16px;
          text-align: left;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          font-size: 12px;
        }

        td {
          padding: 12px 16px;
          border-bottom: 1px solid #e5e7eb;
          color: #1f2937;
        }

        tbody tr:last-child td {
          border-bottom: none;
        }

        .badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
        }

        .badge-success {
          background: #d1fae5;
          color: #047857;
        }

        .badge-failed {
          background: #fee2e2;
          color: #dc2626;
        }

        .badge-active {
          background: #dbeafe;
          color: #1e40af;
        }

        .badge-new {
          background: #fef3c7;
          color: #92400e;
        }

        .empty-state {
          text-align: center;
          padding: 48px 24px;
          color: #6b7280;
        }

        .empty-state p {
          font-size: 14px;
          margin-bottom: 12px;
        }

        .loading {
          text-align: center;
          padding: 24px;
          color: #6b7280;
        }
      `}</style>

      <div className="dashboard-header">
        <h1>Zapier Workflow Dashboard</h1>
        <p>Real-time tracking of webhook leads, partners, and program enrollments</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Leads</h3>
          <div className="value">{stats.totalLeads}</div>
        </div>
        <div className="stat-card">
          <h3>Converted Partners</h3>
          <div className="value">{stats.totalClients}</div>
        </div>
        <div className="stat-card">
          <h3>Program Enrollments</h3>
          <div className="value">{stats.totalEnrollments}</div>
        </div>
        <div className="stat-card">
          <h3>Successful Events</h3>
          <div className="value" style={{ color: "#10b981" }}>
            {stats.recentEvents}
          </div>
        </div>
        {stats.failedEvents > 0 && (
          <div className="stat-card">
            <h3>Failed Events</h3>
            <div className="value" style={{ color: "#ef4444" }}>
              {stats.failedEvents}
            </div>
          </div>
        )}
      </div>

      <div className="tabs">
        <button
          className={`tab-button ${activeTab === "events" ? "active" : ""}`}
          onClick={() => setActiveTab("events")}
        >
          All Events ({events.length})
        </button>
        <button
          className={`tab-button ${activeTab === "leads" ? "active" : ""}`}
          onClick={() => setActiveTab("leads")}
        >
          Leads ({leads.length})
        </button>
        <button
          className={`tab-button ${activeTab === "clients" ? "active" : ""}`}
          onClick={() => setActiveTab("clients")}
        >
          Partners ({clients.length})
        </button>
        <button
          className={`tab-button ${activeTab === "enrollments" ? "active" : ""}`}
          onClick={() => setActiveTab("enrollments")}
        >
          Enrollments ({enrollments.length})
        </button>
      </div>

      {loading ? (
        <div className="loading">Loading workflow data...</div>
      ) : (
        <>
          {activeTab === "events" && (
            <div className="table-container">
              {events.length === 0 ? (
                <div className="empty-state">
                  <p>No workflow events yet</p>
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Event Type</th>
                      <th>Status</th>
                      <th>Data</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((event) => (
                      <tr key={event.id}>
                        <td>
                          <strong>{event.event_type}</strong>
                        </td>
                        <td>
                          <span className={`badge badge-${event.status}`}>
                            {event.status}
                          </span>
                        </td>
                        <td style={{ fontSize: "12px", color: "#6b7280" }}>
                          {event.error_message ? (
                            <span style={{ color: "#dc2626" }}>Error: {event.error_message}</span>
                          ) : (
                            <span>{JSON.stringify(event.event_data).substring(0, 80)}...</span>
                          )}
                        </td>
                        <td>{formatDate(event.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === "leads" && (
            <div className="table-container">
              {leads.length === 0 ? (
                <div className="empty-state">
                  <p>No leads captured yet</p>
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Service Type</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((lead) => (
                      <tr key={lead.id}>
                        <td>{lead.name}</td>
                        <td>{lead.email}</td>
                        <td>{lead.service_type}</td>
                        <td>
                          <span className={`badge badge-${lead.status}`}>
                            {lead.status}
                          </span>
                        </td>
                        <td>{formatDate(lead.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === "clients" && (
            <div className="table-container">
              {clients.length === 0 ? (
                <div className="empty-state">
                  <p>No converted partners yet</p>
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Service</th>
                      <th>Value</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((client) => (
                      <tr key={client.id}>
                        <td>{client.name}</td>
                        <td>{client.email}</td>
                        <td>{client.service_type}</td>
                        <td>${client.client_value.toFixed(2)}</td>
                        <td>
                          <span className="badge badge-active">{client.status}</span>
                        </td>
                        <td>{formatDate(client.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === "enrollments" && (
            <div className="table-container">
              {enrollments.length === 0 ? (
                <div className="empty-state">
                  <p>No program enrollments yet</p>
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Student Name</th>
                      <th>Program</th>
                      <th>Tier</th>
                      <th>Start Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrollments.map((enrollment) => (
                      <tr key={enrollment.id}>
                        <td>{enrollment.student_name}</td>
                        <td>{enrollment.program_name}</td>
                        <td>{enrollment.program_tier}</td>
                        <td>{new Date(enrollment.start_date).toLocaleDateString()}</td>
                        <td>
                          <span className="badge badge-active">{enrollment.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

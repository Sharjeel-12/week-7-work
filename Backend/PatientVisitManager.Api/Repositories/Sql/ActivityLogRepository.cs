using Microsoft.Data.SqlClient;
using PatientVisitManager.Api.Repositories.Interfaces;

namespace PatientVisitManager.Api.Repositories.Sql;
public class ActivityLogRepository : BaseRepository, IActivityLogRepository
{
    public ActivityLogRepository(IConfiguration cfg) : base(cfg) { }
    public async Task LogAsync(string userEmail, string description)
    {
        using var conn = CreateConn(); await conn.OpenAsync();
        int loggerId;
        using (var getLogger = conn.CreateCommand())
        {
            getLogger.CommandText = "SELECT TOP 1 loggerID FROM dbo.loggers WHERE name=@N";
            getLogger.Parameters.AddWithValue("@N", userEmail);
            var existing = await getLogger.ExecuteScalarAsync();
            if (existing == null)
            {
                using var ins = conn.CreateCommand();
                ins.CommandText = "INSERT INTO dbo.loggers (name) OUTPUT INSERTED.loggerID VALUES (@N)";
                ins.Parameters.AddWithValue("@N", userEmail);
                loggerId = (int)(await ins.ExecuteScalarAsync() ?? 0);
            }
            else
            {
                loggerId = Convert.ToInt32(existing);
            }
        }
        var now = DateTime.Now;
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "INSERT INTO dbo.loggerActivities (activityDescription, loggerID, ActivityDate, ActivityTime) VALUES (@D,@L,@Date,@Time)";
        cmd.Parameters.AddWithValue("@D", description);
        cmd.Parameters.AddWithValue("@L", loggerId);
        cmd.Parameters.AddWithValue("@Date", now.Date);
        cmd.Parameters.AddWithValue("@Time", now.TimeOfDay);
        await cmd.ExecuteNonQueryAsync();
    }
}

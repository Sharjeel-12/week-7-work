namespace PatientVisitManager.Api.Repositories.Interfaces;
public interface IActivityLogRepository
{
    Task LogAsync(string userEmail, string description);
}

namespace PatientVisitManager.Api.DTOs;
public record CreateVisitDto(int VisitID, string VisitType, int? VisitTypeID, int VisitDuration, DateTime VisitDate);
public record UpdateVisitDto(int VisitID, string VisitType, int? VisitTypeID, int VisitDuration, DateTime VisitDate);

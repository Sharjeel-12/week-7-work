using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PatientVisitManager.Api.DTOs;
using PatientVisitManager.Api.Models;
using PatientVisitManager.Api.Repositories.Interfaces;
using PatientVisitManager.Api.Services.Interfaces;
using System.Security.Claims;

namespace PatientVisitManager.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class VisitsController : ControllerBase
{
    private readonly IVisitRepository _repo;
    private readonly IFeeCalculator _calc;
    private readonly IActivityLogRepository _log;

    public VisitsController(IVisitRepository repo, IFeeCalculator calc, IActivityLogRepository log)
    {
        _repo = repo;
        _calc = calc;
        _log = log;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<Visit>>> GetAll()
        => Ok(await _repo.GetAllAsync());

    [HttpGet("{id:int}")]
    public async Task<ActionResult<Visit>> Get(int id)
    {
        var v = await _repo.GetByIdAsync(id);
        return v is null ? NotFound() : Ok(v);
    }

    [HttpPost]
    [Authorize(Policy = "RequireReceptionistOrAdmin")]
    public async Task<ActionResult> Create([FromBody] CreateVisitDto dto)
    {
        var perMin = await _repo.GetFeePerMinuteByVisitTypeAsync(dto.VisitType);
        var fee = _calc.Calculate(dto.VisitType, dto.VisitDuration, perMin);

        var id = await _repo.CreateAsync(new Visit
        {
            VisitID = dto.VisitID,
            VisitType = dto.VisitType,
            VisitTypeID = dto.VisitTypeID,
            VisitDuration = dto.VisitDuration,
            VisitDate = dto.VisitDate,
            VisitTime = dto.VisitTime,
            VisitFee = fee,
            PatientID = dto.PatientID,
            DoctorID = dto.DoctorID
        });

        await _log.LogAsync(GetUserId(), $"Created visit {id}");

        return CreatedAtAction(nameof(Get), new { id }, new { id });
    }

    [HttpPut("{id:int}")]
    [Authorize(Policy = "RequireReceptionistOrAdmin")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateVisitDto dto)
    {
        if (id != dto.VisitID) return BadRequest("ID mismatch");

        var perMin = await _repo.GetFeePerMinuteByVisitTypeAsync(dto.VisitType);
        var fee = _calc.Calculate(dto.VisitType, dto.VisitDuration, perMin);

        await _repo.UpdateAsync(new Visit
        {
            VisitID = dto.VisitID,
            VisitType = dto.VisitType,
            VisitTypeID = dto.VisitTypeID,
            VisitDuration = dto.VisitDuration,
            VisitDate = dto.VisitDate,
            VisitTime = dto.VisitTime,
            VisitFee = fee,
            PatientID = dto.PatientID,
            DoctorID = dto.DoctorID
        });

        await _log.LogAsync(GetUserId(), $"Updated visit {id}");

        return NoContent();
    }

    [HttpDelete("{id:int}")]
    [Authorize(Policy = "RequireAdmin")]
    public async Task<IActionResult> Delete(int id)
    {
        await _repo.DeleteAsync(id);
        await _log.LogAsync(GetUserId(), $"Deleted visit {id}");
        return NoContent();
    }

    private int? GetUserId()
    {
        var s = User.FindFirstValue(ClaimTypes.NameIdentifier)
             ?? User.FindFirstValue("uid");
        return int.TryParse(s, out var parsed) ? parsed : (int?)null;
    }
}

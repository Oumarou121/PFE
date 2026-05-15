using System.Security.Claims;
using DocApi.Common;
using DocApi.DTOs;
using DocApi.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DocApi.Controllers
{
    [ApiController]
    [Route("api/admin/users")]
    [Authorize(Roles = "admin")]
    public class AdminUsersController : ControllerBase
    {
        private readonly IAdminUserService _service;

        public AdminUsersController(IAdminUserService service)
        {
            _service = service;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<AdminUserResponse>>> GetUsers()
        {
            try
            {
                var currentUser = GetCurrentUser();
                return Ok(await _service.GetOrganizationUsersAsync(currentUser.UserId, currentUser.Role, currentUser.OrganizationId));
            }
            catch (ServiceException ex)
            {
                return BadRequest(new { message = ex.Message, error = ex.Message });
            }
        }

        [HttpGet("{id:int}")]
        public async Task<ActionResult<AdminUserResponse>> GetUser(int id)
        {
            try
            {
                var currentUser = GetCurrentUser();
                return Ok(await _service.GetOrganizationUserAsync(id, currentUser.UserId, currentUser.Role, currentUser.OrganizationId));
            }
            catch (NotFoundException ex)
            {
                return NotFound(new { message = ex.Message, error = ex.Message });
            }
            catch (ServiceException ex)
            {
                return BadRequest(new { message = ex.Message, error = ex.Message });
            }
        }

        [HttpPost]
        public async Task<ActionResult<AdminUserResponse>> CreateUser([FromBody] AdminUserCreateRequest request)
        {
            try
            {
                var currentUser = GetCurrentUser();
                var created = await _service.CreateOrganizationUserAsync(request, currentUser.UserId, currentUser.Role, currentUser.OrganizationId);
                return CreatedAtAction(nameof(GetUser), new { id = created.Id }, created);
            }
            catch (ServiceException ex)
            {
                return BadRequest(new { message = ex.Message, error = ex.Message });
            }
        }

        [HttpPut("{id:int}")]
        public async Task<ActionResult<AdminUserResponse>> UpdateUser(int id, [FromBody] AdminUserUpdateRequest request)
        {
            try
            {
                var currentUser = GetCurrentUser();
                return Ok(await _service.UpdateOrganizationUserAsync(id, request, currentUser.UserId, currentUser.Role, currentUser.OrganizationId));
            }
            catch (NotFoundException ex)
            {
                return NotFound(new { message = ex.Message, error = ex.Message });
            }
            catch (ServiceException ex)
            {
                return BadRequest(new { message = ex.Message, error = ex.Message });
            }
        }

        [HttpDelete("{id:int}")]
        public async Task<ActionResult> DeleteUser(int id)
        {
            try
            {
                var currentUser = GetCurrentUser();
                await _service.DeleteOrganizationUserAsync(id, currentUser.UserId, currentUser.Role, currentUser.OrganizationId);
                return NoContent();
            }
            catch (NotFoundException ex)
            {
                return NotFound(new { message = ex.Message, error = ex.Message });
            }
            catch (ServiceException ex)
            {
                return BadRequest(new { message = ex.Message, error = ex.Message });
            }
        }

        private CurrentUser GetCurrentUser()
        {
            var userIdValue = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrWhiteSpace(userIdValue) || !int.TryParse(userIdValue, out var userId))
            {
                throw new ServiceException("Utilisateur non authentifie");
            }

            var role = User.FindFirst(ClaimTypes.Role)?.Value ?? string.Empty;
            var organizationValue = User.FindFirst("organizationId")?.Value;
            var organizationId = int.TryParse(organizationValue, out var parsedOrganizationId)
                ? parsedOrganizationId
                : (int?)null;

            return new CurrentUser(userId, role, organizationId);
        }

        private sealed record CurrentUser(int UserId, string Role, int? OrganizationId);
    }
}

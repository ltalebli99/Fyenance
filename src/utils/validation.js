export function validateProjectDates(startDate, endDate) {
    if (!startDate || !endDate) return true;
    return new Date(startDate) <= new Date(endDate);
}

export function validateProjectForm(project) {
    if (!project.name?.trim()) {
        showError('Project name is required');
        return false;
    }
    
    if (project.budget && project.budget < 0) {
        showError('Budget cannot be negative');
        return false;
    }
    
    if (project.start_date && project.end_date && 
        !validateProjectDates(project.start_date, project.end_date)) {
        showError('End date must be after start date');
        return false;
    }
    
    return true;
}
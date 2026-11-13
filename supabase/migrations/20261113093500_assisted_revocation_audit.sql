CREATE FUNCTION private.audit_assisted_integration_toggle() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF OLD.enabled IS DISTINCT FROM NEW.enabled THEN
  INSERT INTO private.assisted_audit(action) VALUES(CASE WHEN NEW.enabled THEN 'integration_enabled' ELSE 'integration_revoked' END);
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.audit_assisted_integration_toggle() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER assisted_integration_toggle AFTER UPDATE ON private.assisted_integration
FOR EACH ROW EXECUTE FUNCTION private.audit_assisted_integration_toggle();

import { CertificationService } from '../services/certification';
import { JSONStorage } from '../data/storage';
import { CertificationCategory } from '../types';

describe('CertificationService', () => {
  const testDataDir = './test-data-cert';
  let storage: JSONStorage;
  let certificationService: CertificationService;

  beforeEach(async () => {
    storage = new JSONStorage(testDataDir);
    await storage.initializeDataDirectory();
    certificationService = new CertificationService(storage);
  });

  describe('createCertification', () => {
    it('should create a new certification', async () => {
      const certData = {
        name: 'AWS Certified Solutions Architect',
        issuer: 'Amazon Web Services',
        category: CertificationCategory.CLOUD,
        difficulty: 3,
        description: 'AWS cloud architecture certification',
        validityPeriod: 36
      };

      const certification = await certificationService.createCertification(certData);

      expect(certification.name).toBe(certData.name);
      expect(certification.issuer).toBe(certData.issuer);
      expect(certification.category).toBe(certData.category);
      expect(certification.difficulty).toBe(certData.difficulty);
      expect(certification.description).toBe(certData.description);
      expect(certification.validityPeriod).toBe(certData.validityPeriod);
      expect(certification.id).toBeDefined();
      expect(certification.createdAt).toBeDefined();
      expect(certification.updatedAt).toBeDefined();
    });

    it('should not allow duplicate certifications with same name and issuer', async () => {
      const certData = {
        name: 'Duplicate Cert',
        issuer: 'Test Issuer',
        category: CertificationCategory.SECURITY,
        difficulty: 2,
        description: 'Test certification'
      };

      await certificationService.createCertification(certData);

      await expect(certificationService.createCertification(certData))
        .rejects.toThrow('Certification with same name and issuer already exists');
    });
  });

  describe('updateCertification', () => {
    it('should update certification information', async () => {
      const certData = {
        name: 'Original Cert',
        issuer: 'Test Issuer',
        category: CertificationCategory.PROGRAMMING,
        difficulty: 2,
        description: 'Original description'
      };

      const certification = await certificationService.createCertification(certData);

      const updateData = {
        name: 'Updated Cert',
        difficulty: 4,
        description: 'Updated description'
      };

      const updatedCertification = await certificationService.updateCertification(
        certification.id, 
        updateData
      );

      expect(updatedCertification.name).toBe(updateData.name);
      expect(updatedCertification.difficulty).toBe(updateData.difficulty);
      expect(updatedCertification.description).toBe(updateData.description);
      expect(updatedCertification.issuer).toBe(certData.issuer); // 変更されていない
      expect(updatedCertification.updatedAt).not.toBe(certification.updatedAt);
    });

    it('should throw error when updating non-existent certification', async () => {
      const updateData = {
        name: 'Updated Name'
      };

      await expect(certificationService.updateCertification('non-existent-id', updateData))
        .rejects.toThrow('Certification not found');
    });
  });

  describe('deleteCertification', () => {
    it('should delete certification when no related data exists', async () => {
      const certData = {
        name: 'Delete Test Cert',
        issuer: 'Test Issuer',
        category: CertificationCategory.DATABASE,
        difficulty: 3,
        description: 'Test certification for deletion'
      };

      const certification = await certificationService.createCertification(certData);

      await certificationService.deleteCertification(certification.id);

      const deletedCert = await certificationService.getCertification(certification.id);
      expect(deletedCert).toBeNull();
    });

    it('should throw error when deleting non-existent certification', async () => {
      await expect(certificationService.deleteCertification('non-existent-id'))
        .rejects.toThrow('Certification not found');
    });
  });

  describe('listCertifications', () => {
    beforeEach(async () => {
      // テスト用の資格を複数作成
      const certifications = [
        {
          name: 'AWS Solutions Architect',
          issuer: 'Amazon',
          category: CertificationCategory.CLOUD,
          difficulty: 3,
          description: 'AWS certification'
        },
        {
          name: 'CompTIA Security+',
          issuer: 'CompTIA',
          category: CertificationCategory.SECURITY,
          difficulty: 2,
          description: 'Security certification'
        },
        {
          name: 'Oracle Java SE',
          issuer: 'Oracle',
          category: CertificationCategory.PROGRAMMING,
          difficulty: 4,
          description: 'Java certification'
        }
      ];

      for (const cert of certifications) {
        await certificationService.createCertification(cert);
      }
    });

    it('should return all certifications when no filters applied', async () => {
      const certifications = await certificationService.listCertifications();
      expect(certifications).toHaveLength(3);
    });

    it('should filter by category', async () => {
      const cloudCertifications = await certificationService.listCertifications({
        category: CertificationCategory.CLOUD
      });
      
      expect(cloudCertifications).toHaveLength(1);
      expect(cloudCertifications[0]?.category).toBe(CertificationCategory.CLOUD);
    });

    it('should filter by issuer', async () => {
      const oracleCertifications = await certificationService.listCertifications({
        issuer: 'Oracle'
      });
      
      expect(oracleCertifications).toHaveLength(1);
      expect(oracleCertifications[0]?.issuer).toBe('Oracle');
    });

    it('should filter by difficulty', async () => {
      const difficulty2Certifications = await certificationService.listCertifications({
        difficulty: 2
      });
      
      expect(difficulty2Certifications).toHaveLength(1);
      expect(difficulty2Certifications[0]?.difficulty).toBe(2);
    });
  });

  describe('searchCertifications', () => {
    beforeEach(async () => {
      const certifications = [
        {
          name: 'AWS Certified Solutions Architect',
          issuer: 'Amazon Web Services',
          category: CertificationCategory.CLOUD,
          difficulty: 3,
          description: 'Design and deploy scalable systems on AWS'
        },
        {
          name: 'Microsoft Azure Fundamentals',
          issuer: 'Microsoft',
          category: CertificationCategory.CLOUD,
          difficulty: 1,
          description: 'Basic knowledge of Azure cloud services'
        },
        {
          name: 'CompTIA Security+',
          issuer: 'CompTIA',
          category: CertificationCategory.SECURITY,
          difficulty: 2,
          description: 'Foundational cybersecurity skills'
        }
      ];

      for (const cert of certifications) {
        await certificationService.createCertification(cert);
      }
    });

    it('should search by certification name', async () => {
      const results = await certificationService.searchCertifications('AWS');
      expect(results).toHaveLength(1);
      expect(results[0]?.name).toContain('AWS');
    });

    it('should search by issuer', async () => {
      const results = await certificationService.searchCertifications('Microsoft');
      expect(results).toHaveLength(1);
      expect(results[0]?.issuer).toBe('Microsoft');
    });

    it('should search by description', async () => {
      const results = await certificationService.searchCertifications('cloud');
      expect(results.length).toBeGreaterThan(0);
      results.forEach(cert => {
        expect(
          cert.name.toLowerCase().includes('cloud') ||
          cert.description.toLowerCase().includes('cloud') ||
          cert.category.toLowerCase().includes('cloud')
        ).toBe(true);
      });
    });

    it('should return empty array for non-matching search', async () => {
      const results = await certificationService.searchCertifications('NonExistentTerm');
      expect(results).toHaveLength(0);
    });

    it('should prioritize name matches over other matches', async () => {
      const results = await certificationService.searchCertifications('Azure');
      expect(results).toHaveLength(1);
      expect(results[0]?.name).toContain('Azure');
    });
  });

  describe('getCategoryStats', () => {
    beforeEach(async () => {
      const certifications = [
        {
          name: 'AWS Cert 1',
          issuer: 'Amazon',
          category: CertificationCategory.CLOUD,
          difficulty: 3,
          description: 'AWS certification 1'
        },
        {
          name: 'AWS Cert 2',
          issuer: 'Amazon',
          category: CertificationCategory.CLOUD,
          difficulty: 4,
          description: 'AWS certification 2'
        },
        {
          name: 'Security Cert',
          issuer: 'CompTIA',
          category: CertificationCategory.SECURITY,
          difficulty: 2,
          description: 'Security certification'
        }
      ];

      for (const cert of certifications) {
        await certificationService.createCertification(cert);
      }
    });

    it('should return correct category statistics', async () => {
      const stats = await certificationService.getCategoryStats();
      
      const cloudStat = stats.find(s => s.category === CertificationCategory.CLOUD);
      const securityStat = stats.find(s => s.category === CertificationCategory.SECURITY);
      const programmingStat = stats.find(s => s.category === CertificationCategory.PROGRAMMING);

      expect(cloudStat?.count).toBe(2);
      expect(securityStat?.count).toBe(1);
      expect(programmingStat?.count).toBe(0);
    });

    it('should include all categories even with zero count', async () => {
      const stats = await certificationService.getCategoryStats();
      
      const allCategories = Object.values(CertificationCategory);
      expect(stats).toHaveLength(allCategories.length);
      
      allCategories.forEach(category => {
        const stat = stats.find(s => s.category === category);
        expect(stat).toBeDefined();
        expect(typeof stat?.count).toBe('number');
      });
    });
  });
});